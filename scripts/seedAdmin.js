require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME || 'Admin';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}
if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env before running this script');
  process.exit(1);
}

const supabase = require('../backend/lib/supabase');

async function seed() {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .eq('role', 'admin')
    .maybeSingle();

  if (existing) {
    console.log(`Admin account already exists for ${email} — skipping.`);
    return;
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    console.error('Failed to create auth user:', authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId, email, name, role: 'admin', is_active: true });

  if (profileError) {
    console.error('Failed to upsert profile:', profileError.message);
    process.exit(1);
  }

  console.log(`Admin account created: ${email}`);
}

seed();
