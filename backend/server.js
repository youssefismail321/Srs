require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./lib/supabase');

const authRoutes   = require('./routes/auth');
const userRoutes   = require('./routes/users');
const issueRoutes  = require('./routes/issues');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`>> ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth',   authRoutes);
app.use('/api/users',  userRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/upload', uploadRoutes);

app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`CampusCare API running on port ${PORT}`);
  supabase.from('profiles').select('count').single()
    .then(({ data, error }) => {
      if (error) console.error('Supabase connection FAILED:', error.message);
      else console.log('Supabase connection OK');
    });
});
