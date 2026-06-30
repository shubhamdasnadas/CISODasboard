const express = require('express');
const router = express.Router();

// GET /api/reports
router.get('/', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT * FROM reports ORDER BY created_at DESC');
    res.json({ reports: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/reports
router.post('/', async (req, res) => {
  try {
    const { title, description, type, data, status } = req.body;
    if (!title) return res.status(400).json({ message: 'title is required' });

    const { rows } = await req.orgPool.query(
      `INSERT INTO reports (title, description, type, data, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, description || null, type || 'custom', data ? JSON.stringify(data) : null, status || 'draft', req.user.username || req.user.userId]
    );
    res.status(201).json({ report: rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/reports/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.orgPool.query('DELETE FROM reports WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
