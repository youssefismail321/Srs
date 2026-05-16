require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const supabase = require('../backend/lib/supabase');

const email    = process.env.ADMIN_EMAIL    || 'admin@campuscare.com';
const password = process.env.ADMIN_PASSWORD || 'admin123';
const name     = process.env.ADMIN_NAME     || 'Admin';

async function run() {
  console.log(`Resetting admin: ${email}`);

  // 1. Find existing auth user
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) { console.error('listUsers failed:', listErr.message); process.exit(1); }
  const existing = users.find(u => u.email === email);

  // 2. Delete if exists
  if (existing) {
    console.log('  Deleting auth user:', existing.id);
    const { error: delAuthErr } = await supabase.auth.admin.deleteUser(existing.id);
    if (delAuthErr) { console.error('  Delete auth failed:', delAuthErr.message); process.exit(1); }
  }

  // 3. Delete profile row if orphaned
  await supabase.from('profiles').delete().eq('email', email);
  console.log('  Profile row cleared.');

  // 4. Create fresh auth user
  console.log('  Creating new auth user...');
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: 'admin' },
  });
  if (authErr) { console.error('  Create auth failed:', authErr.message); process.exit(1); }
  const userId = authData.user.id;
  console.log('  New auth user ID:', userId);

  // 5. Wait for trigger then upsert profile
  await new Promise(r => setTimeout(r, 1000));
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: userId,
    email,
    name,
    role: 'admin',
    is_active: true,
  }, { onConflict: 'id' });
  if (profileErr) { console.error('  Profile upsert failed:', profileErr.message); process.exit(1); }

  console.log(`Done. Admin reset: ${email} / ${password}`);
  console.log('New admin user ID:', userId);
}

run();
