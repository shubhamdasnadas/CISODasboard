const express = require('express');
const bcrypt = require('bcrypt');
const { centralPool } = require('../db');
const { authMiddleware, requireSuperAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/users
 * superAdmin only — returns all users with their org names
 */
router.get('/', authMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const result = await centralPool.query(
      `SELECT u.id, u.username, u.role, u.org_ids,
              COALESCE(
                (SELECT array_agg(json_build_object('id', o.id, 'org_name', o.org_name))
                   FROM organisations o WHERE o.id = ANY(u.org_ids)),
                ARRAY[]::json[]
              ) AS organisations
         FROM users u
         ORDER BY u.id ASC`
    );
    return res.json({ users: result.rows });
  } catch (err) {
    console.error('list users error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/users
 * superAdmin only — add a new user
 * Body: { username, password, role, org_ids: number[] }
 */
router.post('/', authMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, role, org_ids } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'username, password, role are required' });
    }
    if (!['superAdmin', 'admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'role must be superAdmin, admin or member' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await centralPool.query(
      `INSERT INTO users (username, password, role, org_ids)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role, org_ids`,
      [username, hashed, role, org_ids || []]
    );

    return res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('create user error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/users/:id
 * superAdmin only
 */
router.delete('/:id', authMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await centralPool.query('DELETE FROM users WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('delete user error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;