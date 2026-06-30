const express = require('express');
const router = express.Router();

// GET /api/support
router.get('/', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT * FROM support_tickets ORDER BY created_at DESC');
    res.json({ tickets: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/support
router.post('/', async (req, res) => {
  try {
    const { subject, description, priority } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ message: 'subject and description are required' });
    }
    const { rows } = await req.orgPool.query(
      `INSERT INTO support_tickets (subject, description, priority, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [subject, description, priority || 'medium', req.user.username || req.user.userId]
    );
    res.status(201).json({ ticket: rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/support/:id
router.put('/:id', async (req, res) => {
  try {
    const { status, assigned_to } = req.body;
    const updates = [];
    const values = [];
    let i = 1;
    if (status) { updates.push(`status = $${i++}`); values.push(status); }
    if (assigned_to) { updates.push(`assigned_to = $${i++}`); values.push(assigned_to); }
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    await req.orgPool.query(
      `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $${i}`,
      values
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
