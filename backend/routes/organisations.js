const express = require('express');
const { centralPool, getOrgPool, closeOrgPool } = require('../db');
const { authMiddleware, requireSuperAdmin } = require('../middleware/authMiddleware');
const { Client } = require('pg');

const router = express.Router();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'root';

async function dropOrgDatabase(orgId) {
  const dbName = `ciso_org_${orgId}`;
  // Postgres requires connecting to a different DB before dropping one,
  // and no other sessions can be using it — so close the cached pool first.
  closeOrgPool(orgId);

  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: 'postgres',
    user: DB_USER,
    password: DB_PASSWORD,
  });
  await client.connect();
  try {
    // Terminate any leftover sessions on this DB, then drop it.
    await client.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName]
    );
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dbName)) {
      throw new Error(`Refusing to DROP DATABASE with unsafe name: ${dbName}`);
    }
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  } finally {
    await client.end();
  }
}

/**
 * GET /api/organisations
 * Always uses the central pool — orgs are identity / registry data.
 * - superAdmin sees all orgs
 * - admin/member sees only their own orgs
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { role, org_ids } = req.user;
    let result;
    if (role === 'superAdmin') {
      result = await centralPool.query('SELECT * FROM organisations ORDER BY id ASC');
    } else {
      if (!org_ids || org_ids.length === 0) {
        return res.json({ organisations: [] });
      }
      result = await centralPool.query(
        'SELECT * FROM organisations WHERE id = ANY($1::int[]) ORDER BY id ASC',
        [org_ids]
      );
    }
    return res.json({ organisations: result.rows });
  } catch (err) {
    console.error('list orgs error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/organisations
 * superAdmin only — add a new organisation.
 * Creates the org registry row AND its per-org database.
 */
router.post('/', authMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const { org_name, address, mobile_no } = req.body;
    if (!org_name) return res.status(400).json({ error: 'org_name is required' });

    const result = await centralPool.query(
      `INSERT INTO organisations (org_name, address, mobile_no)
       VALUES ($1, $2, $3) RETURNING *`,
      [org_name, address || null, mobile_no || null]
    );
    const newOrg = result.rows[0];

    // Create the per-org DB and apply the schema.
    const { ensureOrgDatabases } = require('../db');
    await ensureOrgDatabases();

    return res.status(201).json({ organisation: newOrg });
  } catch (err) {
    console.error('create org error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/organisations/:id
 * superAdmin only — drops both the registry row and the per-org database.
 */
router.delete('/:id', authMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await centralPool.query('DELETE FROM organisations WHERE id = $1', [id]);
    try {
      await dropOrgDatabase(id);
    } catch (e) {
      console.error(`Warning: failed to drop ciso_org_${id}:`, e.message);
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('delete org error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;