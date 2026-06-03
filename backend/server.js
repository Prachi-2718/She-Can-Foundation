const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { dbRun, dbGet, dbAll } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'she_can_foundation_super_secret_key_2026';

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disabled for Chart.js CDN inline styles
}));
app.use(cors());
app.use(express.json());

// API Rate Limiting to prevent spam
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access Denied: No Token Provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Access Denied: Invalid Token' });
    }
    req.user = user;
    next();
  });
}

// ---------------- API ENDPOINTS ----------------

// 1. Submit contact form (Public)
app.post('/api/submit', async (req, res) => {
  const { name, email, message } = req.body;

  // Backend Validation
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Name must be at least 2 characters long' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Please provide a valid email address' });
  }
  if (!message || message.trim().length < 10) {
    return res.status(400).json({ success: false, error: 'Message must be at least 10 characters long' });
  }

  try {
    const result = await dbRun(
      'INSERT INTO submissions (name, email, message) VALUES (?, ?, ?)',
      [name.trim(), email.trim(), message.trim()]
    );
    res.status(201).json({
      success: true,
      message: 'Form Submitted Successfully',
      submissionId: result.id
    });
  } catch (error) {
    console.error('Database Error on Submit:', error);
    res.status(500).json({ success: false, error: 'Failed to save submission to the database' });
  }
});

// 2. Admin Login (Public)
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username.trim()]);
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid username or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ success: false, error: 'Invalid username or password' });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      success: true,
      token,
      username: user.username
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 2.5 Export submissions to CSV (Protected)
app.get('/api/admin/export', authenticateToken, async (req, res) => {
  try {
    const submissions = await dbAll('SELECT * FROM submissions ORDER BY created_at DESC');
    
    if (submissions.length === 0) {
      return res.status(404).json({ success: false, error: 'No data to export' });
    }

    const headers = ['ID', 'Name', 'Email', 'Message', 'Date', 'Status'];
    const csvRows = [headers.join(',')];

    submissions.forEach(sub => {
      // Escape commas and quotes for CSV
      const message = sub.message.replace(/"/g, '""');
      const row = [
        sub.id,
        `"${sub.name}"`,
        `"${sub.email}"`,
        `"${message}"`,
        `"${new Date(sub.created_at).toISOString()}"`,
        sub.status
      ];
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('she-can-submissions.csv');
    return res.send(csvString);
  } catch (error) {
    console.error('Export Error:', error);
    res.status(500).json({ success: false, error: 'Failed to export data' });
  }
});

// 3. Get all submissions (Protected)
app.get('/api/admin/submissions', authenticateToken, async (req, res) => {
  const { status, search } = req.query;
  let sql = 'SELECT * FROM submissions WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    sql += ' AND (name LIKE ? OR email LIKE ? OR message LIKE ?)';
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  sql += ' ORDER BY created_at DESC';

  try {
    const submissions = await dbAll(sql, params);
    res.json({ success: true, submissions });
  } catch (error) {
    console.error('Fetch Submissions Error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve submissions' });
  }
});

// 4. Update submission status (Protected)
app.put('/api/admin/submissions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['new', 'read', 'flagged'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid or missing status value' });
  }

  try {
    const result = await dbRun('UPDATE submissions SET status = ? WHERE id = ?', [status, id]);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }
    res.json({ success: true, message: `Submission marked as ${status}` });
  } catch (error) {
    console.error('Update Status Error:', error);
    res.status(500).json({ success: false, error: 'Failed to update submission status' });
  }
});

// 5. Delete submission (Protected)
app.delete('/api/admin/submissions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await dbRun('DELETE FROM submissions WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }
    res.json({ success: true, message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Delete Submission Error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete submission' });
  }
});

// 6. Get admin overview stats (Protected)
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    // Total Count
    const totalRow = await dbGet('SELECT COUNT(*) as count FROM submissions');
    const total = totalRow.count;

    // Status counts
    const newCountRow = await dbGet("SELECT COUNT(*) as count FROM submissions WHERE status = 'new'");
    const readCountRow = await dbGet("SELECT COUNT(*) as count FROM submissions WHERE status = 'read'");
    const flaggedCountRow = await dbGet("SELECT COUNT(*) as count FROM submissions WHERE status = 'flagged'");

    // Timeline count for past 7 days (grouped by date)
    const timeline = await dbAll(`
      SELECT date(created_at) as date, COUNT(*) as count 
      FROM submissions 
      GROUP BY date(created_at) 
      ORDER BY date ASC 
      LIMIT 7
    `);

    // Top domains
    const domainsData = await dbAll(`
      SELECT substr(email, instr(email, '@') + 1) as domain, COUNT(*) as count
      FROM submissions
      GROUP BY domain
      ORDER BY count DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      stats: {
        total,
        new: newCountRow.count,
        read: readCountRow.count,
        flagged: flaggedCountRow.count,
        timeline,
        domains: domainsData
      }
    });
  } catch (error) {
    console.error('Get Stats Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
});

// Catch-all route to serve index.html for undefined requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
