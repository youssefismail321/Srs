require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const supabase = require('../backend/lib/supabase');

async function run() {
  const { data: authUsers, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) { console.error('listUsers error:', listErr.message); process.exit(1); }

  const admin = authUsers.users.find(u => u.email === 'admin@campuscare.com');
  console.log('Auth user exists:', !!admin);
  console.log('Auth user ID:', admin?.id ?? 'N/A');

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'admin@campuscare.com')
    .single();

  if (profErr) console.log('Profile fetch error:', profErr.message);
  console.log('Profile:', profile);
  console.log('Profile ID matches auth ID:', profile?.id === admin?.id);
}

run();
