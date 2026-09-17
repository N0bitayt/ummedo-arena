import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseConfig = {
  url: process.env.REACT_APP_SUPABASE_URL,
  anonKey: process.env.REACT_APP_SUPABASE_ANON_KEY,
};

export const isSupabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseConfig.url as string, supabaseConfig.anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
