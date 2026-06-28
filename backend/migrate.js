/**
 * One-shot migration: copy existing api_tokens + api_responses rows from the
 * central DB into each per-org database (ciso_org_<id>).
 *
 * Idempotent — each per-org DB has a `_migration_done` flag table.
 * If the flag row exists, that org is skipped.
 *
 * Auto-runs at startup. Can also be invoked manually: `node migrate.js`.
 */

const { centralPool, getOrgPool } = require('./db');

async function isMigrated(orgPool) {
  const r = await orgPool.query('SELECT 1 FROM _migration_done LIMIT 1');
  return r.rows.length > 0;
}

async function markMigrated(orgPool) {
  await orgPool.query('INSERT INTO _migration_done DEFAULT VALUES');
}

async function migrateOrg(org) {
  const orgPool = getOrgPool(org.id);

  if (await isMigrated(orgPool)) {
    console.log(`✔  ciso_org_${org.id}: already migrated`);
    return { tokens: 0, responses: 0 };
  }

  // Copy tokens
  const { rows: tokens } = await centralPool.query(
    'SELECT api_name, token, created_at FROM api_tokens WHERE org_id = $1 ORDER BY id ASC',
    [org.id]
  );
  for (const t of tokens) {
    await orgPool.query(
      'INSERT INTO api_tokens (api_name, token, created_at) VALUES ($1, $2, $3)',
      [t.api_name, t.token, t.created_at || new Date()]
    );
  }

  // Copy responses
  const { rows: responses } = await centralPool.query(
    'SELECT api_name, response_data, fetched_at FROM api_responses WHERE org_id = $1 ORDER BY id ASC',
    [org.id]
  );
  for (const r of responses) {
    await orgPool.query(
      'INSERT INTO api_responses (api_name, response_data, fetched_at) VALUES ($1, $2::jsonb, $3)',
      [r.api_name, JSON.stringify(r.response_data), r.fetched_at || new Date()]
    );
  }

  await markMigrated(orgPool);
  console.log(`✔  ciso_org_${org.id}: migrated ${tokens.length} token(s), ${responses.length} response(s)`);

  return { tokens: tokens.length, responses: responses.length };
}

async function runMigration() {
  console.log('🚚 Starting data migration to per-org databases...');
  const { rows: orgs } = await centralPool.query(
    'SELECT id, org_name FROM organisations ORDER BY id ASC'
  );

  if (orgs.length === 0) {
    console.log('ℹ️  No organisations to migrate.');
    return;
  }

  let totals = { tokens: 0, responses: 0 };
  for (const org of orgs) {
    try {
      const r = await migrateOrg(org);
      totals.tokens += r.tokens;
      totals.responses += r.responses;
    } catch (e) {
      console.error(`❌ Migration failed for org ${org.id} (${org.org_name}):`, e.message);
    }
  }
  console.log(`🚚 Migration complete. Totals: ${totals.tokens} tokens, ${totals.responses} responses.`);
}

// Allow running standalone: `node migrate.js`
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { runMigration };