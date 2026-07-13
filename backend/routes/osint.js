const express = require('express');
const axios = require('axios');
const { getOrgPool, getOrgSlug } = require('../db');
const { authMiddleware } = require('../middleware/authMiddleware');
const { OSINT_TOOLS } = require('../osintTools');

const router = express.Router();

const TOOLS_BY_ID = Object.fromEntries(OSINT_TOOLS.map((t) => [t.id, t]));
const TOOL_METADATA = OSINT_TOOLS.map(({ id, label, needsKey, keyFields }) => ({
  id, label, needsKey, keyFields: keyFields || 1,
}));

function canAccessOrg(user, orgId) {
  if (user.role === 'superAdmin') return true;
  return Array.isArray(user.org_ids) && user.org_ids.includes(orgId);
}

function applyAuth(config, tool, token) {
  if (tool.authType === 'header') {
    config.headers = { ...config.headers, [tool.headerName]: (tool.headerPrefix || '') + token };
  } else if (tool.authType === 'query') {
    config.params = { ...config.params, [tool.paramName]: token };
  } else if (tool.authType === 'basic') {
    const [username, password] = String(token).split(':');
    config.auth = { username, password: password || '' };
  }
  // 'formField' is applied earlier, before the form body is built (see runTool).
}

/**
 * Runs one OSINT tool's request live and returns a shaped result.
 * Never throws — auth/network/API errors are captured into the result so
 * the route always returns 200 and the frontend can render a clean state.
 */
async function runTool(pool, tool) {
  if (tool.needsKey) {
    const { rows } = await pool.query('SELECT token FROM api_tokens WHERE api_name = $1 LIMIT 1', [tool.id]);
    if (rows.length === 0) {
      return { configured: false };
    }
    return { configured: true, ...(await execute(tool, rows[0].token)) };
  }

  // Keyless tools: attach a token opportunistically if one happens to be
  // configured (e.g. NVD), otherwise call unauthenticated.
  const { rows } = await pool.query('SELECT token FROM api_tokens WHERE api_name = $1 LIMIT 1', [tool.id]);
  return { configured: true, ...(await execute(tool, rows[0]?.token)) };
}

async function execute(tool, token) {
  const base = tool.buildRequest();
  const config = { method: base.method, url: base.url, params: base.params, timeout: 10000 };

  if (base.form) {
    const form = { ...base.form };
    if (token && tool.authType === 'formField') form[tool.fieldName] = token;
    config.data = new URLSearchParams(form).toString();
    config.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  } else if (base.data) {
    config.data = base.data;
  }

  if (token && tool.authType !== 'formField') {
    applyAuth(config, tool, token);
  }

  try {
    const response = await axios(config);
    const shaped = tool.postProcess ? tool.postProcess(response.data) : response.data;
    return { data: shaped };
  } catch (err) {
    return { error: true, message: err.response?.data?.error || err.message };
  }
}

/**
 * GET /api/osint/:orgId
 * Tool metadata + which tools have a token configured + latest cached
 * response per tool (from a previous /fetch call). No live calls here.
 */
router.get('/:orgId', authMiddleware, async (req, res) => {
  try {
    const orgId = parseInt(req.params.orgId, 10);
    if (!canAccessOrg(req.user, orgId)) {
      return res.status(403).json({ error: 'Access denied for this org' });
    }
    const orgSlug = await getOrgSlug(orgId);
    if (!orgSlug) return res.status(404).json({ error: 'Organisation not found' });
    const pool = getOrgPool(orgSlug);

    const toolIds = OSINT_TOOLS.map((t) => t.id);
    const [tokenRows, responseRows] = await Promise.all([
      pool.query('SELECT DISTINCT api_name FROM api_tokens WHERE api_name = ANY($1::text[])', [toolIds]),
      pool.query(
        `SELECT DISTINCT ON (api_name) api_name, response_data, fetched_at
           FROM api_responses
          WHERE api_name = ANY($1::text[])
          ORDER BY api_name, fetched_at DESC`,
        [toolIds]
      ),
    ]);

    return res.json({
      tools: TOOL_METADATA,
      configuredApiNames: tokenRows.rows.map((r) => r.api_name),
      responses: responseRows.rows,
    });
  } catch (err) {
    console.error('osint list error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/osint/fetch
 * Body: { org_id, tool_id }
 * Runs one tool live and caches the result. Returns configured:false
 * (not an error) if a key is required but none is stored yet.
 */
router.post('/fetch', authMiddleware, async (req, res) => {
  try {
    const { org_id, tool_id } = req.body;
    const orgId = parseInt(org_id, 10);
    const tool = TOOLS_BY_ID[tool_id];
    if (!orgId || !tool) {
      return res.status(400).json({ error: 'org_id and a valid tool_id are required' });
    }
    if (!canAccessOrg(req.user, orgId)) {
      return res.status(403).json({ error: 'Access denied for this org' });
    }
    const orgSlug = await getOrgSlug(orgId);
    if (!orgSlug) return res.status(404).json({ error: 'Organisation not found' });
    const pool = getOrgPool(orgSlug);

    const result = await runTool(pool, tool);
    if (!result.configured) {
      return res.json(result);
    }

    const upsert = await pool.query(
      `INSERT INTO api_responses (api_name, response_data)
       VALUES ($1, $2::jsonb)
       RETURNING api_name, response_data, fetched_at`,
      [tool.id, JSON.stringify(result)]
    );
    return res.json(upsert.rows[0]);
  } catch (err) {
    console.error('osint fetch error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
