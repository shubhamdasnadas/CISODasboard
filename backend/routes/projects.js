const express = require('express');
const router = express.Router();

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json({ projects: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/projects
router.post('/', async (req, res) => {
  try {
    const { name, key, description, status } = req.body;
    if (!name || !key) return res.status(400).json({ message: 'name and key are required' });

    const { rows } = await req.orgPool.query(
      `INSERT INTO projects (name, key, description, status, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, key, description || null, status || 'active', req.user.username || req.user.userId]
    );
    res.status(201).json({ project: rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.orgPool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
