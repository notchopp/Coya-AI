import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Handles Google Calendar OAuth callback
 * Exchanges code for tokens and stores them in calendar_connections table
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("OAuth error:", error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}/settings?calendar_error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}/settings?calendar_error=missing_params`
      );
    }

    // Decode state to get business_id and program_id
    let stateData: { business_id: string; program_id: string | null };
    try {
      stateData = JSON.parse(Buffer.from(state, "base64").toString());
    } catch (e) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}/settings?calendar_error=invalid_state`
      );
    }

    const { business_id, program_id } = stateData;

    // Exchange code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}/api/calendar/callback`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Token exchange error:", errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}/settings?calendar_error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Get user info to get email and calendar ID
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error("Failed to get user info");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}/settings?calendar_error=user_info_failed`
      );
    }

    const userInfo = await userInfoResponse.json();
    const email = userInfo.email;
    const providerAccountId = userInfo.id; // Google user ID

    // Get primary calendar ID
    const calendarResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList/primary", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    let calendarId = "primary";
    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json();
      calendarId = calendarData.id || "primary";
    }

    // Calculate token expiration
    const tokenExpiresAt = expires_in 
      ? new Date(Date.now() + (expires_in * 1000))
      : null;

    // Store connection in database
    const supabaseAdmin = getSupabaseAdminClient();

    // Prepare provider_config with additional Google account info
    const providerConfig = {
      user_id: providerAccountId,
      name: userInfo.name,
      picture: userInfo.picture,
      verified_email: userInfo.verified_email,
      locale: userInfo.locale,
    };

    const connectionData: any = {
      business_id,
      program_id: program_id || null,
      calendar_id: calendarId,
      access_token, // In production, encrypt this
      refresh_token, // In production, encrypt this
      token_expires_at: tokenExpiresAt?.toISOString() || null,
      scope,
      email,
      provider: "google", // Set provider to google
      provider_account_id: providerAccountId,
      provider_config: providerConfig,
      is_active: true,
      sync_status: "pending",
      sync_error: null,
    };

    // Use the unique constraint: business_id, program_id, provider, calendar_id
    const { data: upsertedData, error: dbError } = await (supabaseAdmin as any)
      .from("calendar_connections")
      .upsert(connectionData, {
        onConflict: "business_id,program_id,provider,calendar_id",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error storing calendar connection:", dbError);
      console.error("Connection data attempted:", JSON.stringify(connectionData, null, 2));
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}/settings?calendar_error=db_error&details=${encodeURIComponent(dbError.message)}`
      );
    }

    console.log("✅ Calendar connection saved successfully:", {
      id: upsertedData?.id,
      business_id,
      program_id,
      email,
      provider: "google",
      calendar_id: calendarId,
    });

    // Redirect back to settings with success
    const redirectPath = program_id 
      ? `/programs?calendar_connected=true&program_id=${program_id}`
      : `/settings?calendar_connected=true`;

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}${redirectPath}`
    );
  } catch (error) {
    console.error("Calendar callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}/settings?calendar_error=unexpected_error`
    );
  }
}

