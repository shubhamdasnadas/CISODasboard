const express = require('express');
const { centralPool, getOrgPool, getOrgSlug } = require('../db');
const { authMiddleware, requireSuperAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Helper: returns true if the requesting user is allowed to view this org's tokens.
 * superAdmin: all orgs. admin/member: only if their org_ids contains orgId.
 *
 * The user's org_ids come from the CENTRAL database (it's an identity claim,
 * not org-specific data), so we don't use getOrgPool here.
 */
function canAccessOrg(user, orgId) {
  if (user.role === 'superAdmin') return true;
  return Array.isArray(user.org_ids) && user.org_ids.includes(orgId);
}

/**
 * GET /api/tokens/:orgId
 * Reads tokens from the per-org database ciso_org_<orgId>.
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
    const result = await pool.query(
      'SELECT id, api_name, token, created_at FROM api_tokens ORDER BY id ASC'
    );
    return res.json({ tokens: result.rows });
  } catch (err) {
    console.error('list tokens error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/tokens
 * Body: { org_id, api_name, token }
 * superAdmin or admin of that org.
 * Writes to the per-org database ciso_org_<orgId>.
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { org_id, api_name, token } = req.body;
    if (!org_id || !api_name || !token) {
      return res.status(400).json({ error: 'org_id, api_name, token are required' });
    }
    const orgId = parseInt(org_id, 10);
    if (!canAccessOrg(req.user, orgId)) {
      return res.status(403).json({ error: 'Access denied for this org' });
    }
    const orgSlug = await getOrgSlug(orgId);
    if (!orgSlug) return res.status(404).json({ error: 'Organisation not found' });
    const pool = getOrgPool(orgSlug);
    const result = await pool.query(
      `INSERT INTO api_tokens (api_name, token)
       VALUES ($1, $2)
       RETURNING id, api_name, token`,
      [api_name, token]
    );
    return res.status(201).json({ token: result.rows[0] });
  } catch (err) {
    console.error('create token error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/tokens/:id?org_id=<id>
 * superAdmin only — delete a token from a per-org database.
 * Requires org_id so we know which DB to delete from.
 */
router.delete('/:id', authMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const orgId = parseInt(req.query.org_id, 10);
    if (!orgId) {
      return res.status(400).json({ error: 'org_id query param is required' });
    }
    const orgSlug = await getOrgSlug(orgId);
    if (!orgSlug) return res.status(404).json({ error: 'Organisation not found' });
    const pool = getOrgPool(orgSlug);
    await pool.query('DELETE FROM api_tokens WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('delete token error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;