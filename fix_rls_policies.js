import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

global.WebSocket = class DummyWebSocket {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, 'apps', 'api', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || "https://wbrculvtacfkjzqhhoue.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { disabled: true }
});

async function main() {
  console.log("Checking database connection and testing table access...");

  const tables = ['profiles', 'drivers', 'induction_progress', 'documents', 'certificates', 'audit_logs', 'driver_feedback', 'quiz_attempts'];

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('count', { count: 'exact', head: true });
    if (error) {
      console.error(`Table ${t} error:`, error.message);
    } else {
      console.log(`Table ${t}: OK (accessible via Service Key)`);
    }
  }

  // Also test standard anon key access
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { disabled: true }
  });
  console.log("\nTesting Anon Client Access to profiles table...");
  const { data: anonData, error: anonError } = await anonClient.from('profiles').select('*').limit(5);
  if (anonError) {
    console.error("Anon query error on profiles:", anonError.message);
  } else {
    console.log(`Anon query OK. Returned ${anonData?.length} rows.`);
  }
}

main().catch(console.error);
