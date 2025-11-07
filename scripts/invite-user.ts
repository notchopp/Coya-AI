/**
 * Script to invite a user via Supabase Admin API
 * 
 * Usage:
 *   npx tsx scripts/invite-user.ts <email> <business_id> [role]
 * 
 * Example:
 *   npx tsx scripts/invite-user.ts user@example.com abc123-def456-ghi789 user
 */

import { getSupabaseAdminClient } from "../lib/supabase-admin";

async function inviteUser(email: string, businessId: string, role: string = "user") {
  try {
    console.log(`📧 Inviting user: ${email}`);
    console.log(`🏢 Business ID: ${businessId}`);
    console.log(`👤 Role: ${role}`);
    
    const supabaseAdmin = getSupabaseAdminClient();

    // Step 1: Check if user already exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from("users")
      .select("id, email, auth_user_id, business_id")
      .eq("email", email)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      throw new Error(`Failed to check existing user: ${checkError.message}`);
    }

    let userId: string | null = null;

    if (existingUser) {
      if (existingUser.auth_user_id) {
        console.log("❌ User already exists and has an account");
        return;
      }
      console.log("✅ User exists in users table, will link auth_user_id after invite");
      userId = existingUser.id;
    } else {
      // Step 2: Create user record
      console.log("📝 Creating user record in users table...");
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          email: email,
          business_id: businessId,
          is_active: true,
          role: role,
        })
        .select("id")
        .single();

      if (createError) {
        throw new Error(`Failed to create user record: ${createError.message}`);
      }

      userId = newUser.id;
      console.log("✅ User record created");
    }

    // Step 3: Send invitation
    console.log("📨 Sending invitation email...");
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://coya-ai.vercel.app";
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${siteUrl}/auth/callback`,
        data: {
          business_id: businessId,
          role: role,
        }
      }
    );

    if (inviteError) {
      // Clean up user record if invite fails
      if (!existingUser) {
        await supabaseAdmin.from("users").delete().eq("id", userId);
      }
      throw new Error(`Failed to send invitation: ${inviteError.message}`);
    }

    console.log("✅ Invitation sent successfully");

    // Step 4: Link auth_user_id if user was created
    if (inviteData?.user && !existingUser?.auth_user_id) {
      console.log("🔗 Linking auth_user_id to user record...");
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({ auth_user_id: inviteData.user.id })
        .eq("id", userId);

      if (updateError) {
        console.warn("⚠️ Failed to link auth_user_id (will be linked when user accepts invite):", updateError.message);
      } else {
        console.log("✅ Auth user ID linked successfully");
      }
    }

    console.log("\n🎉 Success! Invitation sent to:", email);
    console.log("📋 User ID:", inviteData?.user?.id);
    console.log("🔗 They will receive an email to set up their account");

  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error("Usage: npx tsx scripts/invite-user.ts <email> <business_id> [role]");
    console.error("Example: npx tsx scripts/invite-user.ts user@example.com abc123-def456-ghi789 user");
    process.exit(1);
  }

  const [email, businessId, role = "user"] = args;
  inviteUser(email, businessId, role);
}

export { inviteUser };

