import { createClient } from "@supabase/supabase-js";

// Creates an admin client using SERVICE_ROLE_KEY for admin operations
// This should ONLY be used server-side (API routes, server components)
let adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdminClient() {
  if (adminClient) return adminClient;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || url.trim() === "" || !serviceRoleKey || serviceRoleKey.trim() === "") {
    const errorMsg = `Missing Supabase admin envs: NEXT_PUBLIC_SUPABASE_URL=${!!url}, SUPABASE_SERVICE_ROLE_KEY=${!!serviceRoleKey}. Make sure SUPABASE_SERVICE_ROLE_KEY is set in your .env.local file and Vercel environment variables.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  try {
    adminClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    return adminClient;
  } catch (e) {
    const errorMsg = `Failed to create Supabase admin client: ${e instanceof Error ? e.message : String(e)}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}







