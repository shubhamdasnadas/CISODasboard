const express = require('express');
const router = express.Router();
const { syncFirewall, REPORTS } = require('../services/firewall');

// GET /api/firewall/credentials
router.get('/credentials', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      "SELECT credentials, updated_at FROM integration_credentials WHERE integration = 'firewall' LIMIT 1"
    );
    if (!rows[0]) return res.json({});
    return res.json({ ...rows[0].credentials, lastSyncedAt: rows[0].updated_at });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/firewall/credentials
router.put('/credentials', async (req, res) => {
  try {
    const { baseUrl, apiKey } = req.body;
    if (!baseUrl || !apiKey) {
      return res.status(400).json({ message: 'baseUrl and apiKey are required' });
    }
    await req.orgPool.query(
      `INSERT INTO integration_credentials (integration, credentials, updated_at)
       VALUES ('firewall', $1, NOW())
       ON CONFLICT (integration) DO UPDATE SET
         credentials = EXCLUDED.credentials,
         updated_at  = EXCLUDED.updated_at`,
      [JSON.stringify({ baseUrl, apiKey })]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/firewall/collect
router.post('/collect', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      "SELECT credentials FROM integration_credentials WHERE integration = 'firewall' LIMIT 1"
    );
    if (!rows[0]) return res.status(400).json({ message: 'Firewall not configured' });

    const result = await syncFirewall(req.orgSlug, rows[0].credentials);
    res.json({
      message: `Collected ${result.success}/${result.total} reports`,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/firewall/reports/:reportName
router.get('/reports/:reportName', async (req, res) => {
  try {
    const { reportName } = req.params;
    const { rows } = await req.orgPool.query(
      'SELECT data, updated_at FROM firewall_reports WHERE report_name = $1 LIMIT 1',
      [reportName]
    );
    if (!rows[0]) return res.json({ data: null, updatedAt: null });
    res.json({ data: rows[0].data, updatedAt: rows[0].updated_at });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/firewall/reports-list
router.get('/reports-list', (req, res) => {
  res.json({ reports: REPORTS });
});

// GET /api/firewall/widgets
router.get('/widgets', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      'SELECT * FROM firewall_widgets ORDER BY created_at ASC'
    );
    res.json({ widgets: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/firewall/widgets
router.post('/widgets', async (req, res) => {
  try {
    const { reportName, xAxis, yAxis, chartType, x, y, w, h } = req.body;
    if (!reportName) return res.status(400).json({ message: 'reportName is required' });

    const { rows } = await req.orgPool.query(
      `INSERT INTO firewall_widgets (report_name, x_axis, y_axis, chart_type, x, y, w, h)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        reportName,
        xAxis || [],
        yAxis || [],
        chartType || 'bar',
        x ?? 0,
        y ?? 0,
        w ?? 7,
        h ?? 44,
      ]
    );
    res.json({ widget: rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/firewall/widgets/:id
router.put('/widgets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reportName, xAxis, yAxis, chartType, x, y, w, h } = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    if (reportName !== undefined) { updates.push(`report_name = $${i++}`); values.push(reportName); }
    if (xAxis !== undefined) { updates.push(`x_axis = $${i++}`); values.push(xAxis); }
    if (yAxis !== undefined) { updates.push(`y_axis = $${i++}`); values.push(yAxis); }
    if (chartType !== undefined) { updates.push(`chart_type = $${i++}`); values.push(chartType); }
    if (x !== undefined) { updates.push(`x = $${i++}`); values.push(x); }
    if (y !== undefined) { updates.push(`y = $${i++}`); values.push(y); }
    if (w !== undefined) { updates.push(`w = $${i++}`); values.push(w); }
    if (h !== undefined) { updates.push(`h = $${i++}`); values.push(h); }

    if (updates.length === 0) return res.json({ success: true });

    values.push(id);
    await req.orgPool.query(
      `UPDATE firewall_widgets SET ${updates.join(', ')} WHERE id = $${i}`,
      values
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/firewall/widgets/:id
router.delete('/widgets/:id', async (req, res) => {
  try {
    await req.orgPool.query('DELETE FROM firewall_widgets WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
