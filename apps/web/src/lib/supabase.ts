import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://wbrculvtacfkjzqhhoue.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndicmN1bHZ0YWNma2p6cWhob3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTA4NDgsImV4cCI6MjEwMDIyNjg0OH0.vxmD4mpvPaG0IhlS7i8FisLXRy6CZdq48ur_4Fr8KN4";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const organizationName = import.meta.env.VITE_ORGANIZATION_NAME || "BNT Logistics";
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
