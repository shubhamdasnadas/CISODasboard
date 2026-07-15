const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getTechniqueMap } = require('../services/mitreAttack');

const router = express.Router();

/**
 * GET /api/mitre/techniques
 * Reference data (not org-specific) — full enterprise ATT&CK technique set,
 * trimmed to { id, name, description }, cached server-side for a day.
 */
router.get('/techniques', authMiddleware, async (req, res) => {
  try {
    const techniques = await getTechniqueMap();
    return res.json({ techniques });
  } catch (err) {
    console.error('mitre techniques fetch error:', err);
    return res.status(502).json({ error: 'Failed to load MITRE ATT&CK reference data' });
  }
});

module.exports = router;
