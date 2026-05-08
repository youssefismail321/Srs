const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  'https://tlvkhopxlhehwzfjllbg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsdmtob3B4bGhlaHd6ZmpsbGJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODg1MTc3MywiZXhwIjoyMDk0NDI3NzczfQ.UdCWjiEzrIw2Diz02BqhyCwqlSqq06NiIrRgqYH_fto',
  { realtime: { transport: ws } }
);

async function createAdmin() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@campuscare.com',
    password: 'admin123',
    email_confirm: true,
    user_metadata: { name: 'Admin', role: 'admin' },
  });

  if (error) {
    console.error('Failed to create user:', error.message);
    process.exit(1);
  }

  const userId = data.user.id;
  console.log('User created:', userId);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', userId);

  if (profileError) {
    console.error('Failed to update profile:', profileError.message);
    process.exit(1);
  }

  console.log('Admin profile updated successfully.');
}

createAdmin();
