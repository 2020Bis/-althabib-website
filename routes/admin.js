const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { issueToken, revokeToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try{
    const { password } = req.body;
    if(!password) return res.status(400).json({ error: 'Password is required.' });

    const [rows] = await pool.query('SELECT admin_password_hash FROM settings WHERE id = 1');
    if(rows.length === 0) return res.status(500).json({ error: 'Admin account is not configured. Run the seed script.' });

    const match = await bcrypt.compare(password, rows[0].admin_password_hash);
    if(!match) return res.status(401).json({ error: 'Incorrect password.' });

    const token = issueToken();
    res.json({ token });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// POST /api/admin/logout
router.post('/logout', requireAdmin, (req, res) => {
  const token = req.headers['authorization'].slice(7);
  revokeToken(token);
  res.json({ ok: true });
});

// PUT /api/admin/password
router.put('/password', requireAdmin, async (req, res) => {
  try{
    const { newPassword } = req.body;
    if(!newPassword || newPassword.length < 4){
      return res.status(400).json({ error: 'New password must be at least 4 characters.' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE settings SET admin_password_hash = ? WHERE id = 1', [hash]);
    res.json({ ok: true });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Could not update password.' });
  }
});

module.exports = router;
