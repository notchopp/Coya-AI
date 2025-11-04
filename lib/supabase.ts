import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

// Creates a singleton browser client using NEXT_PUBLIC_* envs.
// Ensure you set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
let browserClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseClient() {
  if (browserClient) return browserClient;
  
  // Ensure we're in browser environment
  if (typeof window === "undefined") {
    throw new Error("getSupabaseClient can only be called in browser environment");
  }
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || url.trim() === "" || !key || key.trim() === "") {
    const errorMsg = `Missing Supabase envs: NEXT_PUBLIC_SUPABASE_URL=${!!url}, NEXT_PUBLIC_SUPABASE_ANON_KEY=${!!key}. Make sure these are set in your .env.local file and Vercel environment variables.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  // Validate URL format
  try {
    const urlObj = new URL(url);
    if (!urlObj.protocol.startsWith("http")) {
      throw new Error("URL must start with http:// or https://");
    }
  } catch (e) {
    const errorMsg = `Invalid Supabase URL format: "${url}". Error: ${e instanceof Error ? e.message : String(e)}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  try {
    browserClient = createClient<Database>(url, key);
    return browserClient;
  } catch (e) {
    const errorMsg = `Failed to create Supabase client: ${e instanceof Error ? e.message : String(e)}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}


