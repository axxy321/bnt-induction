import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

global.WebSocket = class DummyWebSocket {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { disabled: true }
});

async function main() {
  const email = 'admin@bntlogistics.com.au';
  const password = 'Param@2001';
  const fullName = 'BNT Compliance Admin';
  const role = 'admin';

  console.log(`Checking if admin user ${email} exists in Supabase Auth...`);

  // 1. List users to see if account exists
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
    console.log(`User ${email} updated successfully in Supabase Auth.`);
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
    console.log(`User ${email} created successfully in Supabase Auth. ID: ${user.id}`);
  }

  // 2. Insert/Upsert into profiles table
  console.log("Upserting user into profiles table...");
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: user.id,
    email: email,
    full_name: fullName,
    role: role,
    updated_at: new Date().toISOString()
  });

  if (profileErr) {
    console.error("Error updating profiles table:", profileErr);
  } else {
    console.log(`Profile record for ${email} updated with role '${role}'.`);
  }

  console.log("\n✅ ADMIN ACCOUNT READY!");
  console.log("-----------------------------------------");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role:     Compliance Manager (admin)`);
  console.log("-----------------------------------------");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
