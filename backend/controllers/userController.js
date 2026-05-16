const { supabaseAdmin: supabase } = require('../lib/supabase');

async function getAll(req, res) {
  try {
    const { role, is_active } = req.query;

    let query = supabase.from('profiles').select('*').order('name');
    if (role) query = query.eq('role', role);
    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('getAll users error:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

async function getOne(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (err) {
    console.error('getOne user error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.id === id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Cannot update another user\'s profile' });
    }

    if (isAdmin && !isSelf && is_active === false) {
      const { data: target, error: fetchError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', id)
        .single();
      if (fetchError || !target) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (target.role === 'admin') {
        return res.status(403).json({ error: 'Cannot deactivate another admin account' });
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (is_active !== undefined && isAdmin) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('update user error:', err.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;

    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const { data: target, error: fetchError } = await supabase
      .from('profiles')
      .select('role, name')
      .eq('id', id)
      .single();

    if (fetchError || !target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (target.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete another admin account' });
    }

    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: id });
    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: `${target.name} has been permanently deleted` });
  } catch (err) {
    console.error('delete user error:', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

module.exports = { getAll, getOne, update, remove };
