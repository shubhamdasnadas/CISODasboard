const express = require('express');
const router = express.Router();

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100'
    );
    res.json({ notifications: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/notifications
router.post('/', async (req, res) => {
  try {
    const { title, message, type } = req.body;
    if (!title || !message) return res.status(400).json({ message: 'title and message are required' });

    const { rows } = await req.orgPool.query(
      `INSERT INTO notifications (title, message, type) VALUES ($1, $2, $3) RETURNING *`,
      [title, message, type || 'info']
    );
    res.status(201).json({ notification: rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    await req.orgPool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
