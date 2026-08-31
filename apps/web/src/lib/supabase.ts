import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://bnt-logistics-fallback.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbGxiYWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDA0ODAwMDAsImV4cCI6MjAxNjA1NjAwMH0.fallback_key";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    "⚠️ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment variables. Using fallback mode for UI rendering."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const organizationName = import.meta.env.VITE_ORGANIZATION_NAME || "BNT Logistics";
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

