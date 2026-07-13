/**
 * Seed dummy data into each per-org database (ciso_org_<id>).
 *
 * - 3-4 API tokens per org
 * - 5-6 cached responses per org (realistic security data)
 * - Idempotent via a `_seed_done` flag table inside each per-org DB
 *
 * Auto-runs on server startup AFTER runMigration(). Can also be invoked
 * standalone: `node seed-data.js`.
 *
 * Realistic note: the response payloads below are example/demo JSON only.
 * Replace them with real vendor API output once integrated.
 */

const { centralPool, getOrgPool } = require('./db');

const API_NAMES = ['SentinelOne', 'Firewall', 'Checkpoint', 'CrowdStrike'];

/**
 * Build a realistic-looking but FAKE token string for demo purposes.
 * Format: `tk_<vendor>_<orgId>_<randomhex>`
 */
function fakeToken(vendor, orgId) {
  const hex = Math.random().toString(16).slice(2, 18).padEnd(16, '0');
  return `tk_${vendor.toLowerCase()}_org${orgId}_${hex}`;
}

/**
 * Build the dummy token list for an org — varies by org id so each org
 * looks distinct in the dashboard.
 */
function tokensForOrg(org) {
  // Different orgs use slightly different stacks so the demo looks varied.
  const stacks = {
    1: ['SentinelOne', 'Firewall', 'Checkpoint'],                  // Techsec — 3 tokens
    2: ['SentinelOne', 'Checkpoint', 'CrowdStrike'],               // PCPL — 3 tokens
    3: ['SentinelOne', 'Firewall', 'Checkpoint', 'CrowdStrike'],  // Acme — 4 tokens
    4: ['Firewall', 'CrowdStrike'],                                // Northwind — 2 tokens
    5: ['SentinelOne', 'Checkpoint', 'CrowdStrike'],               // BlueShield — 3 tokens
  };
  const names = stacks[org.id] || ['SentinelOne', 'Firewall'];
  return names.map((api_name) => ({
    api_name,
    token: fakeToken(api_name, org.id),
  }));
}

/**
 * Build 5-6 realistic-looking responses for an org.
 * Spread fetched_at over the last few hours so the dashboard looks "live".
 */
function responsesForOrg(org) {
  const now = Date.now();
  const hour = 60 * 60 * 1000;

  const base = [
    {
      api_name: 'SentinelOne',
      response_data: {
        threats: [
          {
            id: 'th-' + org.id + '-001',
            threatName: 'Ransomware.Sample.A',
            severity: 'critical',
            classification: 'Malware',
            status: 'active',
            agentComputerName: `WS-${org.id}-FIN-01`,
            detectedAt: new Date(now - 2 * hour).toISOString(),
          },
          {
            id: 'th-' + org.id + '-002',
            threatName: 'Trojan.Generic.X',
            severity: 'high',
            classification: 'Trojan',
            status: 'mitigated',
            agentComputerName: `WS-${org.id}-HR-12`,
            detectedAt: new Date(now - 5 * hour).toISOString(),
          },
        ],
        pagination: { totalItems: 2, page: 0 },
      },
      fetched_at: new Date(now - 5 * 60 * 1000),
    },
    {
      api_name: 'SentinelOne',
      response_data: {
        threats: [
          {
            id: 'th-' + org.id + '-003',
            threatName: 'Suspicious.PowerShell',
            severity: 'medium',
            classification: 'Suspicious Activity',
            status: 'under investigation',
            agentComputerName: `SRV-${org.id}-DC-01`,
            detectedAt: new Date(now - 8 * hour).toISOString(),
          },
        ],
        pagination: { totalItems: 1, page: 0 },
      },
      fetched_at: new Date(now - 30 * 60 * 1000),
    },
    {
      api_name: 'Firewall',
      response_data: {
        status: 'operational',
        uptime_hours: 24 * 30 * (1 + org.id),
        active_sessions: 200 + org.id * 47,
        blocked_attacks_24h: 12 + org.id * 3,
        top_blocked_sources: [
          { country: 'CN', count: 41 },
          { country: 'RU', count: 23 },
          { country: 'US', count: 7 },
        ],
      },
      fetched_at: new Date(now - 10 * 60 * 1000),
    },
    {
      api_name: 'Checkpoint',
      response_data: {
        alerts: [
          {
            id: 'cp-' + org.id + '-101',
            severity: 'high',
            product: 'Application Control',
            name: 'Unauthorised executable',
            src: '10.0.' + org.id + '.42',
            dst: '185.220.101.5',
            time: new Date(now - 1 * hour).toISOString(),
          },
          {
            id: 'cp-' + org.id + '-102',
            severity: 'medium',
            product: 'URL Filtering',
            name: 'Access to known malicious site',
            src: '10.0.' + org.id + '.108',
            dst: 'malicious-c2.example',
            time: new Date(now - 3 * hour).toISOString(),
          },
        ],
        total: 2,
      },
      fetched_at: new Date(now - 1 * 60 * 1000),
    },
    {
      api_name: 'CrowdStrike',
      response_data: {
        detections: [
          {
            id: 'cs-' + org.id + '-501',
            name: 'Suspicious child of Office',
            severity: 3,
            host: `LAPTOP-${org.id}-DEV-04`,
            tactic: 'Execution',
            technique: 'T1059',
            timestamp: new Date(now - 4 * hour).toISOString(),
          },
        ],
        hosts_under_attack: 1 + org.id,
        devices_total: 120 + org.id * 15,
      },
      fetched_at: new Date(now - 45 * 60 * 1000),
    },
    {
      api_name: 'Firewall',
      response_data: {
        status: 'operational',
        uptime_hours: 24 * 60 * (1 + org.id),
        active_sessions: 280 + org.id * 31,
        blocked_attacks_24h: 18 + org.id * 4,
      },
      fetched_at: new Date(now - 2 * hour),
    },
  ];

  // Filter to only the API names this org actually has tokens for.
  const orgApiNames = new Set((tokensForOrg(org)).map((t) => t.api_name));
  return base.filter((r) => orgApiNames.has(r.api_name));
}

async function isSeeded(orgPool) {
  const r = await orgPool.query('SELECT 1 FROM _seed_done LIMIT 1');
  return r.rows.length > 0;
}

async function markSeeded(orgPool) {
  await orgPool.query('INSERT INTO _seed_done DEFAULT VALUES');
}

async function seedOrg(org) {
  const pool = getOrgPool(org.slug);

  if (await isSeeded(pool)) {
    console.log(`✔  ciso_org_${org.slug}: dummy data already seeded`);
    return { tokens: 0, responses: 0 };
  }

  // Insert tokens
  const tokens = tokensForOrg(org);
  for (const t of tokens) {
    await pool.query(
      'INSERT INTO api_tokens (api_name, token) VALUES ($1, $2)',
      [t.api_name, t.token]
    );
  }

  // Insert responses
  const responses = responsesForOrg(org);
  for (const r of responses) {
    await pool.query(
      'INSERT INTO api_responses (api_name, response_data, fetched_at) VALUES ($1, $2::jsonb, $3)',
      [r.api_name, JSON.stringify(r.response_data), r.fetched_at]
    );
  }

  await markSeeded(pool);
  console.log(`✔  ciso_org_${org.id} (${org.org_name}): seeded ${tokens.length} token(s), ${responses.length} response(s)`);

  return { tokens: tokens.length, responses: responses.length };
}

async function runSeedData() {
  console.log('🌱 Seeding dummy data into per-org databases...');

  // Ensure each per-org DB has the _seed_done table — schema_per_org.sql
  // already creates it, but if the DB existed before that schema was added
  // we may need to create it on the fly.
  const { rows: orgs } = await centralPool.query(
    'SELECT id, slug, org_name FROM organisations ORDER BY id ASC'
  );

  if (orgs.length === 0) {
    console.log('ℹ️  No organisations to seed.');
    return;
  }

  let totals = { tokens: 0, responses: 0 };
  for (const org of orgs) {
    try {
      if (!org.slug) { console.warn(`⚠️  Skipped org ${org.id}: no slug`); continue; }
      const pool = getOrgPool(org.slug);
      // Defensive: create the flag table if it doesn't exist yet.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS _seed_done (
          id SERIAL PRIMARY KEY,
          done_at TIMESTAMP DEFAULT NOW()
        )
      `);
      const r = await seedOrg(org);
      totals.tokens += r.tokens;
      totals.responses += r.responses;
    } catch (e) {
      console.error(`❌ Seed failed for org ${org.id} (${org.org_name}):`, e.message);
    }
  }
  console.log(`🌱 Seed complete. Totals: ${totals.tokens} tokens, ${totals.responses} responses.`);
}

if (require.main === module) {
  runSeedData()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { runSeedData };