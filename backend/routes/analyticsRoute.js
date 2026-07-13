const express = require('express');
const router = express.Router();

// GET /api/analytics — returns aggregated stats
router.get('/', async (req, res) => {
  try {
    const pool = req.orgPool;
    const [countRes, pageRes, dailyRes, userRes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM analytics_events'),
      pool.query(`
        SELECT page AS _id, COUNT(*)::int AS count
        FROM analytics_events
        WHERE page IS NOT NULL
        GROUP BY page ORDER BY count DESC LIMIT 20
      `),
      pool.query(`
        SELECT DATE(created_at)::text AS _id, COUNT(*)::int AS count
        FROM analytics_events
        GROUP BY DATE(created_at) ORDER BY _id
      `),
      pool.query(`
        SELECT "user" AS _id, COUNT(*)::int AS count
        FROM analytics_events
        WHERE "user" IS NOT NULL
        GROUP BY "user" ORDER BY count DESC LIMIT 10
      `),
    ]);
    res.json({
      totalEvents: countRes.rows[0]?.total ?? 0,
      pageStats: pageRes.rows,
      dailyStats: dailyRes.rows,
      topUsers: userRes.rows,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/analytics
router.post('/', async (req, res) => {
  try {
    const { event, page, metadata } = req.body;
    if (!event) return res.status(400).json({ message: 'event is required' });

    await req.orgPool.query(
      `INSERT INTO analytics_events (event, page, "user", metadata) VALUES ($1, $2, $3, $4)`,
      [event, page || null, req.user.username || req.user.userId, metadata ? JSON.stringify(metadata) : null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
