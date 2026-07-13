const express = require('express');
const router = express.Router();

// GET /api/dashboard/layout
router.get('/layout', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { rows } = await req.orgPool.query(
      'SELECT layout FROM dashboard_layout WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    res.json({ layout: rows[0]?.layout ?? null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/dashboard/layout
router.put('/layout', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { layout } = req.body;
    await req.orgPool.query(
      `INSERT INTO dashboard_layout (user_id, layout, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET layout = EXCLUDED.layout, updated_at = NOW()`,
      [userId, JSON.stringify(layout)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/aggregate  — single endpoint that returns all data for the dashboard
router.get('/aggregate', async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = req.orgPool;

    const [
      layoutRows,
      threatsRows,
      agentsRows,
      appAgentRows,
      appCveRows,
      deviceControlRows,
      rssRows,
      harmonyRows,
      fwWidgetsRows,
    ] = await Promise.all([
      pool.query('SELECT layout FROM dashboard_layout WHERE user_id = $1 LIMIT 1', [userId]),
      pool.query('SELECT data FROM s1_threats ORDER BY synced_at DESC'),
      pool.query('SELECT data FROM s1_agents ORDER BY synced_at DESC'),
      pool.query('SELECT data FROM s1_application_agent ORDER BY synced_at DESC'),
      pool.query('SELECT data FROM s1_application_cve ORDER BY synced_at DESC'),
      pool.query('SELECT data FROM s1_device_control ORDER BY synced_at DESC'),
      pool.query('SELECT data FROM s1_rss ORDER BY synced_at DESC'),
      pool.query('SELECT * FROM checkpoint_events ORDER BY synced_at DESC'),
      pool.query('SELECT * FROM firewall_widgets ORDER BY created_at ASC'),
    ]);

    res.json({
      layout: layoutRows.rows[0]?.layout ?? null,
      sentinelone: {
        threats: threatsRows.rows.map(r => r.data),
        agents: agentsRows.rows.map(r => r.data),
        applicationAgent: appAgentRows.rows.map(r => r.data),
        applicationCve: appCveRows.rows.map(r => r.data),
        deviceControl: deviceControlRows.rows.map(r => r.data),
        rss: rssRows.rows.map(r => r.data),
      },
      harmony: {
        events: harmonyRows.rows,
      },
      firewall: {
        widgets: fwWidgetsRows.rows,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const pool = req.orgPool;
    const [threats, agents, events, tickets] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM s1_threats'),
      pool.query('SELECT COUNT(*) FROM s1_agents'),
      pool.query('SELECT COUNT(*) FROM checkpoint_events'),
      pool.query('SELECT COUNT(*) FROM support_tickets WHERE status = $1', ['open']),
    ]);

    res.json({
      s1Threats: parseInt(threats.rows[0].count, 10),
      s1Agents: parseInt(agents.rows[0].count, 10),
      harmonyEvents: parseInt(events.rows[0].count, 10),
      openTickets: parseInt(tickets.rows[0].count, 10),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
