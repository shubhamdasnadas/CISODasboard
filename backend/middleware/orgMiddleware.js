const { centralPool, getOrgPool } = require('../db');

// Resolves the active org for the request and attaches req.currentOrgId + req.orgSlug + req.orgPool.
// Reads org from (in order): X-Org-Id header, ?orgId= query param, first in user.org_ids.
// Validates the authenticated user actually belongs to that org.
async function orgMiddleware(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const rawId =
    req.headers['x-org-id'] ||
    req.query.orgId ||
    (Array.isArray(user.org_ids) && user.org_ids[0]);

  const orgId = parseInt(rawId, 10);
  if (!orgId) {
    return res.status(400).json({ error: 'No active organisation. Set X-Org-Id header.' });
  }

  try {
    const { rows } = await centralPool.query('SELECT slug FROM organisations WHERE id = $1', [orgId]);
    const orgSlug = rows[0]?.slug;
    if (!orgSlug) {
      return res.status(400).json({ error: 'Organisation not found' });
    }

    // superAdmin can access any org; other users must belong to it
    if (
      user.role !== 'superAdmin' &&
      (!Array.isArray(user.org_ids) || !user.org_ids.includes(orgId))
    ) {
      return res.status(403).json({ error: 'Access denied to this organisation' });
    }

    req.currentOrgId = orgId;
    req.orgSlug = orgSlug;
    req.orgPool = getOrgPool(orgSlug);
    next();
  } catch (err) {
    console.error('orgMiddleware error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { orgMiddleware };
