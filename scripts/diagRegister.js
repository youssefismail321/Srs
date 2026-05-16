require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const supabase = require('../backend/lib/supabase');

async function run() {
  // Test: try creating a test user and upsert a profile
  const testEmail = `diag_${Date.now()}@test.com`;

  console.log('1. Creating auth user...');
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'test1234',
    email_confirm: true,
    user_metadata: { name: 'DiagUser', role: 'worker' },
  });
  if (authErr) { console.error('Auth create failed:', authErr.message); process.exit(1); }
  console.log('   Auth user created:', authData.user.id);

  // Wait briefly for trigger
  await new Promise(r => setTimeout(r, 1000));

  console.log('2. Checking if trigger created profile...');
  const { data: triggerProfile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).maybeSingle();
  console.log('   Trigger profile:', triggerProfile);

  console.log('3. Attempting upsert...');
  const { error: upsertErr } = await supabase.from('profiles').upsert({
    id: authData.user.id,
    email: testEmail,
    name: 'DiagUser',
    role: 'worker',
    is_active: true,
  }, { onConflict: 'id' });
  console.log('   Upsert error:', upsertErr?.message ?? 'none');

  console.log('4. Cleaning up...');
  await supabase.auth.admin.deleteUser(authData.user.id);
  console.log('   Done.');
}

run();
