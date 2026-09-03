import { createClient } from "@supabase/supabase-js";

// # Lazy Supabase client
export function createSupabaseClient(url, publishableKey) {
  return createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
