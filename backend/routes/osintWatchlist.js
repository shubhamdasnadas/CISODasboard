const express = require('express');
const { getOrgPool, getOrgSlug } = require('../db');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

const VALID_TYPES = ['domain', 'ip', 'keyword'];

function canAccessOrg(user, orgId) {
  if (user.role === 'superAdmin') return true;
  return Array.isArray(user.org_ids) && user.org_ids.includes(orgId);
}

/**
 * GET /api/osint-watchlist/:orgId
 * Reads watchlist entries from the per-org database.
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
      'SELECT id, type, value, is_primary, created_at FROM osint_watchlist ORDER BY type ASC, is_primary DESC, id ASC'
    );
    return res.json({ watchlist: result.rows });
  } catch (err) {
    console.error('list osint watchlist error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/osint-watchlist
 * Body: { org_id, type, value, is_primary? }
 * If is_primary is true, unsets is_primary on other rows of the same type.
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { org_id, type, value, is_primary } = req.body;
    if (!org_id || !type || !value) {
      return res.status(400).json({ error: 'org_id, type, value are required' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of ${VALID_TYPES.join(', ')}` });
    }
    const orgId = parseInt(org_id, 10);
    if (!canAccessOrg(req.user, orgId)) {
      return res.status(403).json({ error: 'Access denied for this org' });
    }
    const orgSlug = await getOrgSlug(orgId);
    if (!orgSlug) return res.status(404).json({ error: 'Organisation not found' });
    const pool = getOrgPool(orgSlug);

    if (is_primary) {
      await pool.query('UPDATE osint_watchlist SET is_primary = FALSE WHERE type = $1', [type]);
    }
    const result = await pool.query(
      `INSERT INTO osint_watchlist (type, value, is_primary)
       VALUES ($1, $2, $3)
       ON CONFLICT (type, value) DO UPDATE SET is_primary = EXCLUDED.is_primary
       RETURNING id, type, value, is_primary, created_at`,
      [type, value, !!is_primary]
    );
    return res.status(201).json({ entry: result.rows[0] });
  } catch (err) {
    console.error('create osint watchlist entry error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PATCH /api/osint-watchlist/:id/primary
 * Body: { org_id, type }
 * Marks this entry primary and unsets siblings of the same type.
 */
router.patch('/:id/primary', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { org_id, type } = req.body;
    if (!org_id || !type) {
      return res.status(400).json({ error: 'org_id and type are required' });
    }
    const orgId = parseInt(org_id, 10);
    if (!canAccessOrg(req.user, orgId)) {
      return res.status(403).json({ error: 'Access denied for this org' });
    }
    const orgSlug = await getOrgSlug(orgId);
    if (!orgSlug) return res.status(404).json({ error: 'Organisation not found' });
    const pool = getOrgPool(orgSlug);

    await pool.query('UPDATE osint_watchlist SET is_primary = FALSE WHERE type = $1', [type]);
    const result = await pool.query(
      'UPDATE osint_watchlist SET is_primary = TRUE WHERE id = $1 RETURNING id, type, value, is_primary, created_at',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    return res.json({ entry: result.rows[0] });
  } catch (err) {
    console.error('set primary osint watchlist entry error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/osint-watchlist/:id?org_id=<id>
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const orgId = parseInt(req.query.org_id, 10);
    if (!orgId) {
      return res.status(400).json({ error: 'org_id query param is required' });
    }
    if (!canAccessOrg(req.user, orgId)) {
      return res.status(403).json({ error: 'Access denied for this org' });
    }
    const orgSlug = await getOrgSlug(orgId);
    if (!orgSlug) return res.status(404).json({ error: 'Organisation not found' });
    const pool = getOrgPool(orgSlug);
    await pool.query('DELETE FROM osint_watchlist WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('delete osint watchlist entry error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
