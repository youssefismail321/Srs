const { supabaseAdmin } = require('../lib/supabase');

// Uses the REST API directly so the shared supabaseAdmin singleton never
// stores a user session (which would replace the service-role key on all
// subsequent DB calls and re-trigger RLS).
async function signInViaRest(email, password) {
  const url = `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Invalid login credentials');
  return data;
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let authData;
    try {
      authData = await signInViaRest(email.trim().toLowerCase(), password);
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }

    if (!authData.access_token) {
      return res.status(401).json({ error: 'Login failed' });
    }

    // Map REST response shape to the shape the rest of the function expects
    authData.session = { access_token: authData.access_token, refresh_token: authData.refresh_token };
    authData.user = authData.user ?? { id: authData.user_id ?? authData.id };

    if (!authData.session) {
      return res.status(401).json({ error: 'Login failed' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      return res.status(500).json({ error: 'Could not load user profile. Please try again.' });
    }
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (!profile.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Contact an administrator.' });
    }

    res.json({
      token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      user: authData.user,
      profile,
    });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
}

async function register(req, res) {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'email, password, name, and role are required' });
    }

    if (role === 'admin') {
      return res.status(403).json({ error: 'Cannot self-register as admin' });
    }

    const validRoles = ['community_member', 'facility_manager', 'worker'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), role },
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Wait briefly for the DB trigger to fire, then upsert to guarantee the row
    await new Promise(r => setTimeout(r, 500));

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        role,
        is_active: true,
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('register profile upsert failed:', profileError.message);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Failed to create profile' });
    }

    res.status(201).json({ message: 'Account created successfully', userId: authData.user.id });
  } catch (err) {
    console.error('register error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
}

async function logout(req, res) {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const token = header.split(' ')[1];
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        await supabaseAdmin.auth.admin.signOut(user.id);
      }
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.json({ message: 'Logged out successfully' });
  }
}

module.exports = { login, register, logout };
