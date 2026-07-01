const express = require('express');
const router = express.Router();
const { syncSentinelOne } = require('../services/sentinelone');

// GET /api/sentinelone/credentials
router.get('/credentials', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      "SELECT credentials, updated_at FROM integration_credentials WHERE integration = 'sentinelone' LIMIT 1"
    );
    if (!rows[0]) return res.json({});
    return res.json({ ...rows[0].credentials, lastSyncedAt: rows[0].updated_at });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/sentinelone/credentials
router.put('/credentials', async (req, res) => {
  try {
    const { accountId, tokenKey, baseUrl } = req.body;
    if (!tokenKey) {
      return res.status(400).json({ message: 'tokenKey is required' });
    }
    await req.orgPool.query(
      `INSERT INTO integration_credentials (integration, credentials, updated_at)
       VALUES ('sentinelone', $1, NOW())
       ON CONFLICT (integration) DO UPDATE SET
         credentials = EXCLUDED.credentials,
         updated_at  = EXCLUDED.updated_at`,
      [JSON.stringify({ accountId, tokenKey, baseUrl })]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sentinelone/sync
router.post('/sync', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      "SELECT credentials FROM integration_credentials WHERE integration = 'sentinelone' LIMIT 1"
    );
    if (!rows[0]) return res.status(400).json({ message: 'SentinelOne not configured' });

    const result = await syncSentinelOne(req.orgSlug, rows[0].credentials);
    const warnings = [];
    if (result.installedAppsError) warnings.push(`Installed apps: ${result.installedAppsError}`);
    res.json({
      success: true,
      message: `Synced ${result.threats} threats, ${result.agents} agents, ${result.installedApps} installed apps`,
      warnings: warnings.length ? warnings : undefined,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sentinelone/db/threats
router.get('/db/threats', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT data FROM s1_threats ORDER BY synced_at DESC');
    res.json({ threats: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sentinelone/db/agents/removed-count
router.get('/db/agents/removed-count', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      `SELECT COUNT(*)::int AS count FROM s1_agents WHERE removed_at IS NOT NULL`
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sentinelone/db/agents
router.get('/db/agents', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      'SELECT data FROM s1_agents WHERE removed_at IS NULL ORDER BY synced_at DESC'
    );
    res.json({ agents: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sentinelone/db/application-agent
router.get('/db/application-agent', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT data FROM s1_application_agent ORDER BY synced_at DESC');
    res.json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sentinelone/db/application-cve
router.get('/db/application-cve', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT data FROM s1_application_cve ORDER BY synced_at DESC');
    res.json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sentinelone/db/device-control
router.get('/db/device-control', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT data FROM s1_device_control ORDER BY synced_at DESC');
    res.json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sentinelone/db/rss
router.get('/db/rss', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT data FROM s1_rss ORDER BY synced_at DESC');
    res.json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sentinelone/threats  (alias — returns same as db/threats)
router.get('/threats', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT data FROM s1_threats ORDER BY synced_at DESC');
    res.json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sentinelone/agentinfo
router.get('/agentinfo', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT data FROM s1_agents ORDER BY synced_at DESC');
    res.json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sentinelone/applicationCVE
router.get('/applicationCVE', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT data FROM s1_application_cve ORDER BY synced_at DESC');
    res.json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sentinelone/applicationagent
router.get('/applicationagent', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT data FROM s1_application_agent ORDER BY synced_at DESC');
    res.json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sentinelone/devicecontrol
router.get('/devicecontrol', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT data FROM s1_device_control ORDER BY synced_at DESC');
    res.json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sentinelone/rss
router.get('/rss', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT data FROM s1_rss ORDER BY synced_at DESC');
    res.json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
