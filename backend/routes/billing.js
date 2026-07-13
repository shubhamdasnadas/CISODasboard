const express = require('express');
const router = express.Router();

// GET /api/billing
router.get('/', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT * FROM billing ORDER BY created_at DESC LIMIT 1');
    res.json({ billing: rows[0] ?? null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/billing
router.put('/', async (req, res) => {
  try {
    const { plan, amount, currency, status, billing_date } = req.body;
    const { rows: existing } = await req.orgPool.query('SELECT id FROM billing LIMIT 1');
    if (existing[0]) {
      await req.orgPool.query(
        `UPDATE billing SET plan = $1, amount = $2, currency = $3, status = $4, billing_date = $5, updated_at = NOW() WHERE id = $6`,
        [plan, amount, currency || 'USD', status || 'active', billing_date || null, existing[0].id]
      );
    } else {
      await req.orgPool.query(
        `INSERT INTO billing (plan, amount, currency, status, billing_date) VALUES ($1, $2, $3, $4, $5)`,
        [plan || 'free', amount || 0, currency || 'USD', status || 'active', billing_date || null]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
