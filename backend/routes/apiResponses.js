const express = require('express');
const axios = require('axios');
const { centralPool, getOrgPool } = require('../db');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

function canAccessOrg(user, orgId) {
  if (user.role === 'superAdmin') return true;
  return Array.isArray(user.org_ids) && user.org_ids.includes(orgId);
}

/**
 * Look up the api_token and call the external endpoint, then store the result
 * in the per-org database (ciso_org_<orgId>).
 */
async function fetchAndStore(orgId, apiName) {
  const pool = getOrgPool(orgId);

  const tokenResult = await pool.query(
    'SELECT token FROM api_tokens WHERE api_name = $1 LIMIT 1',
    [apiName]
  );
  if (tokenResult.rows.length === 0) {
    throw new Error(`No token configured for org=${orgId} api=${apiName}`);
  }
  const token = tokenResult.rows[0].token;

  // Demo external endpoint mapping — replace with real vendor URLs in prod.
  const endpointMap = {
    SentinelOne: 'https://api.sentinelone.com/v2.1/threats',
    Firewall: 'https://firewall.example.com/api/status',
    Checkpoint: 'https://checkpoint.example.com/api/alerts',
  };
  const url = endpointMap[apiName];

  let responseData;
  try {
    if (!url) {
      responseData = {
        note: `No external endpoint configured for api '${apiName}'.`,
        token_prefix: token.slice(0, 6) + '...',
        generated_at: new Date().toISOString(),
      };
    } else {
      const response = await axios.get(url, {
        headers: { Authorization: `ApiToken ${token}` },
        timeout: 10000,
      });
      responseData = response.data;
    }
  } catch (apiErr) {
    responseData = {
      error: true,
      message: apiErr.message,
      endpoint: url || null,
    };
  }

  const upsert = await pool.query(
    `INSERT INTO api_responses (api_name, response_data)
     VALUES ($1, $2::jsonb)
     RETURNING id, api_name, response_data, fetched_at`,
    [apiName, JSON.stringify(responseData)]
  );
  return upsert.rows[0];
}

/**
 * POST /api/responses/fetch
 * Body: { org_id, api_name }
 */
router.post('/fetch', authMiddleware, async (req, res) => {
  try {
    const { org_id, api_name } = req.body;
    const orgId = parseInt(org_id, 10);
    if (!orgId || !api_name) {
      return res.status(400).json({ error: 'org_id and api_name are required' });
    }
    if (!canAccessOrg(req.user, orgId)) {
      return res.status(403).json({ error: 'Access denied for this org' });
    }
    const saved = await fetchAndStore(orgId, api_name);
    return res.json({ response: saved });
  } catch (err) {
    console.error('fetch error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

/**
 * GET /api/responses/:orgId
 * Returns all latest responses for the given org (from its per-org DB).
 */
router.get('/:orgId', authMiddleware, async (req, res) => {
  try {
    const orgId = parseInt(req.params.orgId, 10);
    if (!canAccessOrg(req.user, orgId)) {
      return res.status(403).json({ error: 'Access denied for this org' });
    }
    const pool = getOrgPool(orgId);
    const result = await pool.query(
      `SELECT DISTINCT ON (api_name) id, api_name, response_data, fetched_at
         FROM api_responses
        ORDER BY api_name, fetched_at DESC`
    );
    return res.json({ responses: result.rows });
  } catch (err) {
    console.error('list responses error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, fetchAndStore };