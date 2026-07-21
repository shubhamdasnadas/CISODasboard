const express = require('express');
const router = express.Router();
const axios = require('axios');

const BASE = 'https://graph.microsoft.com/v1.0';

// ── All endpoints to fetch in parallel ────────────────────────────────────────
// key        : used in response + maps to DB table ms_<key>
// path       : Graph API path (appended to BASE)
// table      : DB table name
const ENDPOINTS = [
  { key: 'organization',              path: '/organization',                                          table: 'ms_organization' },
  { key: 'subscribedSkus',            path: '/subscribedSkus',                                        table: 'ms_subscribed_skus' },
  { key: 'domains',                   path: '/domains',                                               table: 'ms_domains' },
  { key: 'users',                     path: '/users',                                                 table: 'ms_users' },
  { key: 'auditSignIns',              path: '/auditLogs/signIns',                                     table: 'ms_audit_sign_ins' },
  { key: 'auditDirectory',            path: '/auditLogs/directoryAudits',                             table: 'ms_audit_directory' },
  { key: 'auditProvisioning',         path: '/auditLogs/provisioning',                                table: 'ms_audit_provisioning' },
  { key: 'riskyUsers',                path: '/identityProtection/riskyUsers',                         table: 'ms_risky_users' },
  { key: 'riskDetections',            path: '/identityProtection/riskDetections',                     table: 'ms_risk_detections' },
  { key: 'riskyServicePrincipals',    path: '/identityProtection/riskyServicePrincipals',             table: 'ms_risky_service_principals' },
  { key: 'securityIncidents',         path: '/security/incidents',                                    table: 'ms_security_incidents' },
  { key: 'securityAlerts',            path: '/security/alerts_v2',                                    table: 'ms_security_alerts' },
  { key: 'secureScores',              path: '/security/secureScores',                                 table: 'ms_secure_scores' },
  { key: 'secureScoreProfiles',       path: '/security/secureScoreControlProfiles',                   table: 'ms_secure_score_profiles' },
  { key: 'managedDevices',            path: '/deviceManagement/managedDevices',                       table: 'ms_managed_devices' },
  { key: 'compliancePolicies',        path: '/deviceManagement/deviceCompliancePolicies',             table: 'ms_compliance_policies' },
  { key: 'deviceConfigurations',      path: '/deviceManagement/deviceConfigurations',                 table: 'ms_device_configurations' },
  { key: 'applications',              path: '/applications',                                          table: 'ms_applications' },
  { key: 'servicePrincipals',         path: '/servicePrincipals',                                     table: 'ms_service_principals' },
  { key: 'serviceHealth',             path: '/admin/serviceAnnouncement/healthOverviews',             table: 'ms_service_health' },
  { key: 'serviceIssues',             path: '/admin/serviceAnnouncement/issues',                      table: 'ms_service_issues' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getMicrosoftToken(tenantId, clientId, clientSecret) {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });
  const res = await axios.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data.access_token;
}

// Fetch one Graph endpoint — returns { data, error }
async function fetchEndpoint(accessToken, path) {
  try {
    const res = await axios.get(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 30000,
    });
    return { data: res.data, error: null };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
    return { data: null, error: msg };
  }
}

// Upsert a single row into a ms_* table (always keep exactly 1 row)
async function upsertTable(pool, table, data) {
  const existing = await pool.query(`SELECT id FROM ${table} LIMIT 1`);
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE ${table} SET data = $1, synced_at = NOW() WHERE id = $2`,
      [JSON.stringify(data), existing.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO ${table} (data, synced_at) VALUES ($1, NOW())`,
      [JSON.stringify(data)]
    );
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/microsoft/credentials
router.get('/credentials', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      "SELECT credentials, updated_at FROM integration_credentials WHERE integration = 'microsoft' LIMIT 1"
    );
    if (!rows[0]) return res.json({});
    const { clientSecret, ...safe } = rows[0].credentials;
    return res.json({ ...safe, lastSyncedAt: rows[0].updated_at });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/microsoft/credentials
router.post('/credentials', async (req, res) => {
  try {
    const { tenantId, clientId, clientSecret } = req.body;
    if (!tenantId || !clientId || !clientSecret)
      return res.status(400).json({ message: 'tenantId, clientId and clientSecret are required' });

    await req.orgPool.query(
      `INSERT INTO integration_credentials (integration, credentials, updated_at)
       VALUES ('microsoft', $1, NOW())
       ON CONFLICT (integration) DO UPDATE SET credentials = EXCLUDED.credentials, updated_at = EXCLUDED.updated_at`,
      [JSON.stringify({ tenantId, clientId, clientSecret })]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/microsoft/sync  — parallel worker fetch of all endpoints
router.post('/sync', async (req, res) => {
  try {
    const { rows } = await req.orgPool.query(
      "SELECT credentials FROM integration_credentials WHERE integration = 'microsoft' LIMIT 1"
    );
    if (!rows[0])
      return res.status(400).json({ message: 'Microsoft not configured. Save credentials first.' });

    const { tenantId, clientId, clientSecret } = rows[0].credentials;

    // Step 1 — get access token
    let accessToken;
    try {
      accessToken = await getMicrosoftToken(tenantId, clientId, clientSecret);
    } catch (err) {
      const msg = err.response?.data?.error_description || err.message;
      return res.status(401).json({ message: `Token fetch failed: ${msg}` });
    }

    // Step 2 — fire all endpoints simultaneously (worker pattern)
    const results = await Promise.allSettled(
      ENDPOINTS.map(async (ep) => {
        const { data, error } = await fetchEndpoint(accessToken, ep.path);
        if (data) await upsertTable(req.orgPool, ep.table, data);
        return { key: ep.key, table: ep.table, ok: !error, error };
      })
    );

    // Step 3 — update credentials timestamp
    await req.orgPool.query(
      "UPDATE integration_credentials SET updated_at = NOW() WHERE integration = 'microsoft'"
    );

    // Build summary
    const summary = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { key: '?', ok: false, error: r.reason?.message }
    );
    const failed = summary.filter((s) => !s.ok);

    res.json({
      success: true,
      message: `Synced ${summary.length - failed.length}/${summary.length} endpoints`,
      syncedAt: new Date().toISOString(),
      results: summary,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/microsoft/data  — returns latest row from every table
router.get('/data', async (req, res) => {
  try {
    const out = {};
    await Promise.all(
      ENDPOINTS.map(async (ep) => {
        const { rows } = await req.orgPool.query(
          `SELECT data, synced_at FROM ${ep.table} ORDER BY synced_at DESC LIMIT 1`
        );
        out[ep.key] = rows[0] ? { data: rows[0].data, syncedAt: rows[0].synced_at } : null;
      })
    );
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/microsoft/data/:key  — single endpoint data
router.get('/data/:key', async (req, res) => {
  const ep = ENDPOINTS.find((e) => e.key === req.params.key);
  if (!ep) return res.status(404).json({ message: 'Unknown key' });
  try {
    const { rows } = await req.orgPool.query(
      `SELECT data, synced_at FROM ${ep.table} ORDER BY synced_at DESC LIMIT 1`
    );
    if (!rows[0]) return res.json({ data: null });
    res.json({ data: rows[0].data, syncedAt: rows[0].synced_at });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
