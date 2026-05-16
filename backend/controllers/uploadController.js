const { supabaseAdmin: supabase } = require('../lib/supabase');

async function upload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { originalname, buffer, mimetype } = req.file;
    const ext = originalname.split('.').pop();
    const fileName = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from('issue-images')
      .upload(fileName, buffer, { contentType: mimetype, upsert: false });

    if (error) return res.status(500).json({ error: error.message });

    const { data: { publicUrl } } = supabase.storage
      .from('issue-images')
      .getPublicUrl(fileName);

    res.json({ url: publicUrl });
  } catch (err) {
    console.error('upload error:', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
}

module.exports = { upload };
