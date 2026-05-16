const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const clientOpts = (key, extraAuth = {}) => ({
  auth: { autoRefreshToken: false, persistSession: false, ...extraAuth },
  realtime: { transport: ws },
  global: { headers: { apikey: key } },
});

// Admin client — service role key, bypasses RLS for all backend operations
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, clientOpts(SERVICE_KEY));

// Anon client — used only for signInWithPassword (user-facing auth)
const supabase = createClient(SUPABASE_URL, ANON_KEY, clientOpts(ANON_KEY));

module.exports = { supabase, supabaseAdmin };
