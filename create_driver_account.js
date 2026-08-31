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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { disabled: true }
});

async function main() {
  const email = 'driver@bntlogistics.com.au';
  const password = 'Driver@2001';
  const fullName = 'Alexander Vance';
  const role = 'driver';

  console.log(`Checking if driver user ${email} exists in Supabase Auth...`);

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError);
    process.exit(1);
  }

  let user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (user) {
    console.log(`Found existing user ID: ${user.id}. Updating password and metadata...`);
    const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: password,
        email_confirm: true,
        user_metadata: { role, full_name: fullName }
      }
    );
    if (updateErr) {
      console.error("Error updating user:", updateErr);
      process.exit(1);
    }
    user = updated.user;
    console.log(`User ${email} updated successfully.`);
  } else {
    console.log(`User ${email} does not exist. Creating new user...`);
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, full_name: fullName }
    });
    if (createErr) {
      console.error("Error creating user:", createErr);
      process.exit(1);
    }
    user = created.user;
    console.log(`User ${email} created successfully. ID: ${user.id}`);
  }

  console.log("Upserting user into profiles table...");
  await supabase.from('profiles').upsert({
    id: user.id,
    email: email,
    full_name: fullName,
    role: role,
    licence_class: 'MC',
    issuing_state: 'VIC',
    depot_location: 'Melbourne Logistics Hub',
    updated_at: new Date().toISOString()
  });

  console.log("\n✅ DRIVER ACCOUNT READY!");
  console.log("-----------------------------------------");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role:     Heavy Vehicle Driver (driver)`);
  console.log("-----------------------------------------");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
