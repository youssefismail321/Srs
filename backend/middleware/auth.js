const { supabaseAdmin: supabase } = require('../lib/supabase');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = header.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, name, role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ error: 'Profile not found' });
    }

    if (!profile.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    req.user = { id: profile.id, email: profile.email, name: profile.name, role: profile.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
