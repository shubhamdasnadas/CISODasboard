const express = require('express');
const router = express.Router();
const axios = require('axios');

// GET /api/zoho  — return cached zoho data from DB
router.get('/', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      'SELECT data_name, data, updated_at FROM zohotable ORDER BY updated_at DESC'
    );
    const result = {};
    rows.forEach(r => { result[r.data_name] = r.data; });
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/zoho/sync  — fetch from Zoho and cache
router.post('/sync', async (req, res) => {
  try {
    const { accessToken, domain = 'https://desk.zoho.in' } = req.body;
    if (!accessToken) return res.status(400).json({ message: 'accessToken is required' });

    const headers = { Authorization: `Zoho-oauthtoken ${accessToken}` };

    // Fetch ticket list
    const ticketRes = await axios.get(`${domain}/api/v1/tickets?limit=100&status=open`, { headers });
    const tickets = ticketRes.data?.data ?? [];

    // Store in zohotable
    await req.orgPool.query(
      `INSERT INTO zohotable (data_name, data, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (data_name) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      ['tickets', JSON.stringify(tickets)]
    );

    res.json({ success: true, count: tickets.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/zoho/tickets-db
router.get('/tickets-db', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      'SELECT * FROM support_tickets ORDER BY created_at DESC'
    );
    const capitalize = (s) => s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown';
    const tickets = rows.map(r => ({
      subject:      r.subject,
      status:       capitalize(r.status),
      priority:     capitalize(r.priority),
      contact_name: r.created_by || '',
      created_time: r.created_at,
      description:  r.description,
    }));
    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
