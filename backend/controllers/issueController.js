const { supabaseAdmin: supabase } = require('../lib/supabase');

async function getAll(req, res) {
  try {
    const { status, assigned_to, created_by } = req.query;

    let issueIds = null;
    if (assigned_to) {
      const { data: assignments } = await supabase
        .from('assignments')
        .select('issue_id')
        .eq('worker_id', assigned_to);
      issueIds = assignments ? assignments.map(a => a.issue_id) : [];
      if (issueIds.length === 0) return res.json([]);
    }

    let query = supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (issueIds) query = query.in('id', issueIds);
    if (created_by) query = query.eq('created_by', created_by);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('getAll issues error:', err.message);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
}

async function getOne(req, res) {
  try {
    const { id } = req.params;

    const [issueRes, historyRes, assignmentRes] = await Promise.all([
      supabase.from('issues').select('*').eq('id', id).single(),
      supabase
        .from('status_history')
        .select('*')
        .eq('issue_id', id)
        .order('changed_at', { ascending: true }),
      supabase
        .from('assignments')
        .select('*, worker:profiles!worker_id(id,name,email,role,is_active,created_at)')
        .eq('issue_id', id)
        .maybeSingle(),
    ]);

    if (issueRes.error || !issueRes.data) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json({
      ...issueRes.data,
      status_history: historyRes.data ?? [],
      assignment: assignmentRes.data ?? null,
    });
  } catch (err) {
    console.error('getOne issue error:', err.message);
    res.status(500).json({ error: 'Failed to fetch issue' });
  }
}

async function create(req, res) {
  try {
    const { title, description, category, location, image_url } = req.body;

    if (!title || !category || !location) {
      return res.status(400).json({ error: 'title, category, and location are required' });
    }

    const validCategories = ['maintenance', 'infrastructure', 'sustainability', 'cleanliness', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('issues')
      .insert({
        title: title.trim(),
        description: description?.trim() ?? null,
        category,
        location: location.trim(),
        image_url: image_url ?? null,
        status: 'pending',
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    console.error('create issue error:', err.message);
    res.status(500).json({ error: 'Failed to create issue' });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.user;

    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('id, status, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const updates = {};
    const validStatuses = ['pending', 'in_progress', 'resolved'];

    if (role === 'facility_manager' || role === 'admin') {
      const { status } = req.body;
      if (status !== undefined) {
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }
        updates.status = status;
      }

    } else if (role === 'worker') {
      const { status } = req.body;
      if (!status) return res.status(400).json({ error: 'Workers can only update status' });

      const workerAllowed = ['in_progress', 'resolved'];
      if (!workerAllowed.includes(status)) {
        return res.status(403).json({ error: 'Workers can only set status to in_progress or resolved' });
      }

      const { data: assignment } = await supabase
        .from('assignments')
        .select('issue_id')
        .eq('issue_id', id)
        .eq('worker_id', req.user.id)
        .maybeSingle();

      if (!assignment) {
        return res.status(403).json({ error: 'You can only update issues assigned to you' });
      }
      updates.status = status;

    } else {
      return res.status(403).json({ error: 'Insufficient permissions to update issues' });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const oldStatus = issue.status;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('issues')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    if (updates.status && updates.status !== oldStatus) {
      await supabase.from('status_history').insert({
        issue_id: id,
        old_status: oldStatus,
        new_status: updates.status,
        changed_by: req.user.id,
        changed_at: new Date().toISOString(),
        note: null,
      });
    }

    res.json(data);
  } catch (err) {
    console.error('update issue error:', err.message);
    res.status(500).json({ error: 'Failed to update issue' });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('id, created_by, title')
      .eq('id', id)
      .single();

    if (fetchError || !issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const isAdmin = role === 'admin';
    const isFacilityManager = role === 'facility_manager';
    const isCreator = issue.created_by === userId;

    if (!isAdmin && !isFacilityManager && !isCreator) {
      return res.status(403).json({ error: 'You can only delete your own issues' });
    }

    const { error } = await supabase
      .from('issues')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Issue deleted successfully' });
  } catch (err) {
    console.error('delete issue error:', err.message);
    res.status(500).json({ error: 'Failed to delete issue' });
  }
}

async function assignWorker(req, res) {
  try {
    const { id } = req.params;
    const { worker_id } = req.body;
    const { role } = req.user;

    if (role !== 'facility_manager' && role !== 'admin') {
      return res.status(403).json({ error: 'Only managers and admins can assign workers' });
    }

    await supabase.from('assignments').delete().eq('issue_id', id);

    if (!worker_id) {
      return res.json({ message: 'Worker unassigned' });
    }

    const { data, error } = await supabase
      .from('assignments')
      .insert({
        issue_id: id,
        worker_id,
        assigned_by: req.user.id,
        assigned_at: new Date().toISOString(),
      })
      .select('*, worker:profiles!worker_id(id,name,email,role,is_active,created_at)')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const { data: issue } = await supabase
      .from('issues')
      .select('status')
      .eq('id', id)
      .single();

    if (issue?.status === 'pending') {
      await supabase
        .from('issues')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', id);
      await supabase.from('status_history').insert({
        issue_id: id,
        old_status: 'pending',
        new_status: 'in_progress',
        changed_by: req.user.id,
        changed_at: new Date().toISOString(),
        note: null,
      });
    }

    res.json(data);
  } catch (err) {
    console.error('assignWorker error:', err.message);
    res.status(500).json({ error: 'Failed to assign worker' });
  }
}

async function getComments(req, res) {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('comments')
      .select('*, author:profiles!user_id(id,name,email,role,is_active,created_at)')
      .eq('issue_id', id)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  } catch (err) {
    console.error('getComments error:', err.message);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
}

async function addComment(req, res) {
  try {
    const { id } = req.params;
    const { content, image_url } = req.body;

    if (!content && !image_url) {
      return res.status(400).json({ error: 'content or image_url is required' });
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        issue_id: id,
        user_id: req.user.id,
        content: content ?? '',
        image_url: image_url ?? null,
      })
      .select('*, author:profiles!user_id(id,name,email,role,is_active,created_at)')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    console.error('addComment error:', err.message);
    res.status(500).json({ error: 'Failed to add comment' });
  }
}

module.exports = { getAll, getOne, create, update, remove, assignWorker, getComments, addComment };
