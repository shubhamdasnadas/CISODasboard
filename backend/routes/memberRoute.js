const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { centralPool } = require('../db');

// GET /api/member/orgs  — current user's org memberships (from org_users table)
router.get('/orgs', async (req, res) => {
  try {
    const { rows } = await centralPool.query(
      `SELECT o.id, o.org_name, o.slug, o.industry, o.plan, o.color, o.is_active,
              ou.role, ou.department, ou.allowed_pages
       FROM org_users ou
       JOIN organisations o ON o.id = ou.org_id
       WHERE ou.email = $1 AND ou.is_active = TRUE AND o.is_active = TRUE
       ORDER BY o.id`,
      [req.user.email || '']
    );
    res.json({ orgs: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function canReadOrg(req, orgId) {
  const { role, org_ids } = req.user;
  if (role === 'superAdmin') return true;
  const xOrgId = parseInt(req.headers['x-org-id'], 10);
  if (xOrgId !== parseInt(orgId, 10)) return false;
  // Any authenticated user belonging to this org can read members
  if (Array.isArray(org_ids) && org_ids.includes(xOrgId)) return true;
  return role === 'admin' || role === 'org_admin' || role === 'member';
}

function canManageOrg(req, orgId) {
  const { role } = req.user;
  if (role === 'superAdmin') return true;
  const xOrgId = parseInt(req.headers['x-org-id'], 10);
  return xOrgId === parseInt(orgId, 10) && (role === 'admin' || role === 'org_admin');
}

// GET /api/member/members — list org members (org_users + system users from users table)
router.get('/members', async (req, res) => {
  try {
    const orgId = parseInt(req.headers['x-org-id'] || req.query.orgId, 10);
    if (!orgId) return res.status(400).json({ message: 'org required' });
    if (!canReadOrg(req, orgId)) return res.status(403).json({ message: 'Access denied' });
    const { rows } = await centralPool.query(
      `SELECT id::text, org_id, name, email, role, department, is_active,
              allowed_pages, created_at, 'org_user' AS user_type
       FROM org_users WHERE org_id = $1
       UNION ALL
       SELECT id::text, $1::int AS org_id, username AS name,
              '' AS email, role, '' AS department, TRUE AS is_active,
              NULL::text[] AS allowed_pages,
              '1970-01-01'::timestamptz AS created_at, 'system_user' AS user_type
       FROM users
       WHERE $1 = ANY(COALESCE(org_ids, ARRAY[]::int[])) AND role != 'superAdmin'
       ORDER BY created_at DESC`,
      [orgId]
    );
    res.json({ members: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/member/members — add member
router.post('/members', async (req, res) => {
  try {
    const orgId = parseInt(req.headers['x-org-id'] || req.body.orgId, 10);
    if (!orgId) return res.status(400).json({ message: 'org required' });
    if (!canManageOrg(req, orgId)) return res.status(403).json({ message: 'Access denied' });
    const { name, email, password, role = 'org_user', department } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'name and email are required' });
    const hashed = password ? await bcrypt.hash(password, 10) : null;
    const { rows } = await centralPool.query(
      `INSERT INTO org_users (org_id, name, email, password, role, department, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE) RETURNING id, org_id, name, email, role, department, is_active, created_at`,
      [orgId, name, email, hashed, role, department || null]
    );
    res.status(201).json({ member: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Email already exists in this org' });
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/member/members/:id
router.put('/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = parseInt(req.headers['x-org-id'] || req.body.orgId, 10);
    if (!canManageOrg(req, orgId)) return res.status(403).json({ message: 'Access denied' });
    const { name, role, department, is_active, allowed_pages } = req.body;
    const { rows } = await centralPool.query(
      `UPDATE org_users SET
         name = COALESCE($1, name),
         role = COALESCE($2, role),
         department = COALESCE($3, department),
         is_active = COALESCE($4, is_active),
         allowed_pages = COALESCE($5, allowed_pages),
         updated_at = NOW()
       WHERE id = $6 AND org_id = $7
       RETURNING id, name, email, role, department, is_active, allowed_pages, created_at`,
      [name || null, role || null, department || null,
       is_active !== undefined ? is_active : null,
       allowed_pages || null, id, orgId]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Member not found' });
    res.json({ member: rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/member/members/:id — deactivates access (soft delete, matching SoneTenancy)
router.delete('/members/:id', async (req, res) => {
  try {
    const orgId = parseInt(req.headers['x-org-id'] || req.query.orgId, 10);
    if (!canManageOrg(req, orgId)) return res.status(403).json({ message: 'Access denied' });
    await centralPool.query(
      'UPDATE org_users SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND org_id = $2',
      [req.params.id, orgId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
