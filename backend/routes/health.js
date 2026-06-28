const express = require('express');
const { centralPool } = require('../db');

const router = express.Router();

/**
 * GET /api/health
 * Public diagnostic endpoint. Tells you:
 *   - whether the API process is alive
 *   - whether the central DB is reachable
 *   - how many users and orgs are registered
 *
 * Use this to confirm the backend is up before debugging the login page.
 * Visit http://localhost:5000/api/health in your browser.
 */
router.get('/', async (req, res) => {
  const result = {
    status: 'ok',
    time: new Date().toISOString(),
    database: { reachable: false, error: null, users: 0, orgs: 0 },
  };

  try {
    const users = await centralPool.query('SELECT COUNT(*)::int AS c FROM users');
    const orgs = await centralPool.query('SELECT COUNT(*)::int AS c FROM organisations');
    result.database.reachable = true;
    result.database.users = users.rows[0].c;
    result.database.orgs = orgs.rows[0].c;
    res.json(result);
  } catch (err) {
    result.status = 'degraded';
    result.database.error = err.message;
    result.database.code = err.code || null;
    res.status(500).json(result);
  }
});

module.exports = router;