import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const OWNER_EMAIL = "whochoppa@gmail.com";

/**
 * Automatically invite the owner (whochoppa@gmail.com) when a business is created
 * This should only be called once per business creation
 * @param businessId The ID of the newly created business
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function autoInviteOwner(businessId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = getSupabaseAdminClient();

    // Check if owner already exists for this business
    const { data: existingOwner, error: checkError } = await supabaseAdmin
      .from("users")
      .select("id, email, auth_user_id, owner_onboarding_completed")
      .eq("business_id", businessId)
      .eq("role", "owner")
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking existing owner:", checkError);
      return { success: false, error: checkError.message };
    }

    // Type assertion for existingOwner
    const owner = existingOwner as { id: string; email: string; auth_user_id: string | null; owner_onboarding_completed: boolean } | null;

    // If owner already exists and has completed onboarding, don't send another invite
    if (owner && owner.owner_onboarding_completed) {
      console.log("Owner already exists and has completed onboarding for business:", businessId);
      return { success: true }; // Not an error, just already done
    }

    // If owner exists but hasn't completed onboarding, allow re-invitation
    let userId: string | null = null;
    if (owner) {
      userId = owner.id;
    } else {
      // Create user record in users table (without auth_user_id initially)
      const userData: any = {
        email: OWNER_EMAIL,
        business_id: businessId,
        is_active: true,
        role: "owner",
        owner_onboarding_completed: false,
      };

      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert(userData)
        .select("id")
        .single();

      if (createError) {
        console.error("Error creating owner user record:", createError);
        return { success: false, error: createError.message };
      }

      userId = (newUser as { id: string }).id;
    }

    // Invite the owner via Supabase Auth
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      OWNER_EMAIL,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app"}/auth/callback`,
        data: {
          business_id: businessId,
          role: "owner",
          program_id: null,
        }
      }
    );

    if (inviteError) {
      console.error("Error inviting owner:", inviteError);
      
      // If invite fails and we created a new user record, clean it up
      if (!owner && userId) {
        await supabaseAdmin
          .from("users")
          .delete()
          .eq("id", userId);
      }
      
      return { success: false, error: inviteError.message };
    }

    console.log("✅ Owner invitation sent successfully to", OWNER_EMAIL, "for business:", businessId);
    return { success: true };

  } catch (error) {
    console.error("Unexpected error in autoInviteOwner:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

