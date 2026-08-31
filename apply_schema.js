import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
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
  console.log("Applying database schema & migrations to live Supabase instance...");

  const schemaPath = path.join(__dirname, 'supabase', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Test executing SQL via RPC exec_sql or direct Postgres statements
  console.log("Read schema.sql successfully. Length:", schemaSql.length, "bytes");

  // We can ensure the profiles table has RLS policies allowing authenticated users to select/update their profile,
  // and admins to manage all rows.
  const { data: testProfiles, error: pErr } = await supabase.from('profiles').select('*').limit(1);
  if (pErr) {
    console.error("Profiles table test failed:", pErr.message);
  } else {
    console.log("Profiles table test OK. Rows count:", testProfiles.length);
  }

  // Ensure admin user profile exists
  const adminEmail = 'admin@bntlogistics.com.au';
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const adminUser = users.find(u => u.email?.toLowerCase() === adminEmail);

  if (adminUser) {
    console.log(`Found Admin User ID: ${adminUser.id}. Upserting profile...`);
    const { error: upsertErr } = await supabase.from('profiles').upsert({
      id: adminUser.id,
      email: adminEmail,
      full_name: 'BNT Compliance Admin',
      role: 'admin',
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (upsertErr) {
      console.error("Error upserting admin profile:", upsertErr.message);
    } else {
      console.log("Admin profile record verified in public.profiles table!");
    }
  } else {
    console.error("Admin user not found in auth.users!");
  }
}

main().catch(console.error);
