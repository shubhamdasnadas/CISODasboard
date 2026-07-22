const express = require('express');
const router = express.Router();
const { syncHexnode } = require('../services/hexnode');

// GET /api/hexnode/credentials
router.get('/credentials', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      "SELECT credentials, updated_at FROM integration_credentials WHERE integration = 'hexnode' LIMIT 1"
    );
    if (!rows[0]) return res.json({});
    return res.json({ ...rows[0].credentials, lastSyncedAt: rows[0].updated_at });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/hexnode/credentials
router.put('/credentials', async (req, res) => {
  try {
    const { baseUrl, apiToken } = req.body;
    if (!baseUrl || !apiToken) {
      return res.status(400).json({ message: 'baseUrl and apiToken are required' });
    }
    await req.orgPool.query(
      `INSERT INTO integration_credentials (integration, credentials, updated_at)
       VALUES ('hexnode', $1, NOW())
       ON CONFLICT (integration) DO UPDATE SET
         credentials = EXCLUDED.credentials,
         updated_at  = EXCLUDED.updated_at`,
      [JSON.stringify({ baseUrl, apiToken })]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/hexnode/sync
router.post('/sync', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      "SELECT credentials FROM integration_credentials WHERE integration = 'hexnode' LIMIT 1"
    );
    if (!rows[0]) return res.status(400).json({ message: 'Hexnode not configured' });

    const result = await syncHexnode(req.orgSlug, rows[0].credentials);
    const warnings = [];
    if (result.deviceAppsError) warnings.push(`Device applications: ${result.deviceAppsError}`);
    res.json({
      success: true,
      message: `Synced ${result.devices} devices, ${result.applications} applications, ${result.deviceApplications} device-app records`,
      warnings: warnings.length ? warnings : undefined,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/hexnode/db/devices
router.get('/db/devices', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT data FROM hexnode_devices ORDER BY synced_at DESC');
    res.json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/hexnode/db/applications
router.get('/db/applications', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query('SELECT data FROM hexnode_applications ORDER BY synced_at DESC');
    res.json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/hexnode/db/device-applications/flagged — installed apps marked black_listed or mandatory_app, across all devices
router.get('/db/device-applications/flagged', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      `SELECT device_id, data FROM hexnode_device_applications
       WHERE (data->>'black_listed')::boolean = true OR (data->>'mandatory_app')::boolean = true
       ORDER BY synced_at DESC`
    );
    res.json({ data: rows.map(r => ({ deviceId: r.device_id, ...r.data })) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/hexnode/db/device-applications?deviceId=<id>
router.get('/db/device-applications', async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) return res.status(400).json({ message: 'deviceId is required' });
    const { rows } = await req.orgPool.query(
      'SELECT data FROM hexnode_device_applications WHERE device_id = $1 ORDER BY synced_at DESC',
      [deviceId]
    );
    res.json({ data: rows.map(r => r.data) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
