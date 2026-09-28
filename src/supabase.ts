import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL?.trim();
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY?.trim();
let client: SupabaseClient | null = null;
// A malformed deployment URL should show unavailable service UI, not a blank app.
if (url && anonKey) {
  try {
    const parsed = new URL(url);
    if (['http:', 'https:'].includes(parsed.protocol)) {
      client = createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    }
  } catch { /* No authenticated operations are allowed without a valid client. */ }
}
export const supabase = client;
export const isSupabaseConfigured = Boolean(client);
