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

    if (!access_token) {
      console.error("No access token received:", tokenData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}/settings?calendar_error=no_access_token`
      );
    }

    // Get user info to get email and calendar ID
    // Try v2 endpoint first, fallback to v1 if needed
    let userInfo: any = null;
    let email: string | null = null;
    let providerAccountId: string | null = null;

    // Try v2 userinfo endpoint
    try {
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      if (userInfoResponse.ok) {
        userInfo = await userInfoResponse.json();
        email = userInfo.email;
        providerAccountId = userInfo.id;
      } else {
        console.warn("v2 userinfo failed, trying v1:", {
          status: userInfoResponse.status,
          statusText: userInfoResponse.statusText,
        });
        
        // Fallback to v1 endpoint
        const userInfoV1Response = await fetch("https://www.googleapis.com/oauth2/v1/userinfo", {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        });

        if (userInfoV1Response.ok) {
          userInfo = await userInfoV1Response.json();
          email = userInfo.email;
          providerAccountId = userInfo.id;
        } else {
          // Last resort: try to get email from token info endpoint
          const tokenInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${access_token}`);
          if (tokenInfoResponse.ok) {
            const tokenInfo = await tokenInfoResponse.json();
            console.warn("Using tokeninfo as fallback:", tokenInfo);
            // Token info doesn't have email, but we can still proceed with a placeholder
            // We'll need email, so this is a problem
          }
        }
      }
    } catch (userInfoError) {
      console.error("Error fetching user info:", userInfoError);
    }

    // If we still don't have email, we can't proceed
    if (!email) {
      console.error("Could not retrieve email from Google. Token data:", {
        has_access_token: !!access_token,
        scope,
        token_keys: Object.keys(tokenData),
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}/settings?calendar_error=no_email_retrieved`
      );
    }

    // Get primary calendar ID (use primary as default, don't fail if this call fails)
    let calendarId = "primary";
    try {
      const calendarResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList/primary", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      if (calendarResponse.ok) {
        const calendarData = await calendarResponse.json();
        calendarId = calendarData.id || "primary";
      } else {
        console.warn("Could not fetch calendar details, using 'primary' as default");
      }
    } catch (calendarError) {
      console.warn("Error fetching calendar details, using 'primary' as default:", calendarError);
      // Continue with "primary" as default
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

