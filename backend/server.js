require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const { centralPool, ensureOrgDatabases, getOrgPool, shutdownAllPools } = require('./db');
const { runMigration } = require('./migrate');
const { runSeedData } = require('./seed-data');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const orgRoutes = require('./routes/organisations');
const tokenRoutes = require('./routes/apiTokens');
const { router: responseRoutes, fetchAndStore } = require('./routes/apiResponses');
const healthRoutes = require('./routes/health');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ name: 'CISO Dashboard API', status: 'running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organisations', orgRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/health', healthRoutes);

/**
 * Background job — every 1 minute, fetch every api_token row across ALL
 * per-org databases and store responses in the matching org DB.
 */
async function runBackgroundJob() {
  try {
    // Pull org ids from the central registry (identity data).
    const { rows: orgs } = await centralPool.query('SELECT id FROM organisations ORDER BY id ASC');
    let total = 0;

    for (const { id: orgId } of orgs) {
      let tokens;
      try {
        const pool = getOrgPool(orgId);
        const r = await pool.query('SELECT api_name FROM api_tokens ORDER BY id ASC');
        tokens = r.rows;
      } catch (e) {
        console.error(`[cron] Cannot read tokens for org=${orgId}:`, e.message);
        continue;
      }

      for (const { api_name } of tokens) {
        try {
          await fetchAndStore(orgId, api_name);
          total += 1;
        } catch (e) {
          console.error(`[cron] Failed org=${orgId} api=${api_name}:`, e.message);
        }
      }
    }
    console.log(`[cron] Refreshed ${total} API token(s) across ${orgs.length} org(s).`);
  } catch (err) {
    console.error('[cron] Job error:', err.message);
  }
}

// Every 1 minute — fetches every org's api_tokens and refreshes responses
cron.schedule('*/1 * * * *', runBackgroundJob);

async function main() {
  // 0. Smoke-test the central DB connection BEFORE doing any work.
  //    Without this, a wrong DB password or unreachable Postgres wouldn't
  //    show up until the first login attempt returns a generic 500.
  try {
    await centralPool.query('SELECT 1');
    console.log(`🔌 Central DB connection OK (${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'cisodashboard'})`);
  } catch (err) {
    console.error('\n❌ FATAL: Cannot connect to the central PostgreSQL database.\n');
    console.error('   Check these in backend/.env:');
    console.error('     DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
    console.error('   And make sure you ran setup.sql in pgAdmin to create the database.\n');
    console.error('   Underlying error:', err.message, '\n');
    process.exit(1);
  }

  // 1. Ensure each registered organisation has its own database + schema.
  await ensureOrgDatabases();

  // 2. Migrate existing central-DB data into the per-org DBs (idempotent).
  await runMigration();

  // 3. Seed dummy data into any per-org DB that doesn't have it yet.
  await runSeedData();

  // 4. Start the HTTP server.
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://10.134.243.128:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ FATAL: Port ${PORT} is already in use.`);
      console.error(`   Either stop the process holding it, or set PORT=<other> in backend/.env\n`);
    } else {
      console.error('\n❌ FATAL: HTTP server error:', err.message, '\n');
    }
    process.exit(1);
  });

  // 5. Run the background fetch once after 3 seconds (gives the server time to bind).
  setTimeout(runBackgroundJob, 3000);
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

// Clean shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await shutdownAllPools();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await shutdownAllPools();
  process.exit(0);
});