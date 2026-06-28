/**
 * Diagnostic script — tests the entire backend stack without the frontend.
 *
 * Usage:  node test-backend.js
 *
 * Tests in order:
 *   1. Can we connect to the central DB?
 *   2. Does the `users` table exist with rows?
 *   3. Does the `organisations` table exist with rows?
 *   4. Does each registered org have its own ciso_org_<id> database?
 *   5. Is the auth route reachable and returning the right shape?
 *
 * Stop at the first failure and read the message — it tells you exactly
 * what to fix.
 */

require('dotenv').config();
const http = require('http');
const { centralPool } = require('./db');

const PORT = process.env.PORT || 5000;
let failed = 0;

function pass(label) {
  console.log(`  ✅ ${label}`);
}
function fail(label, detail) {
  console.error(`  ❌ ${label}`);
  if (detail) console.error(`     ${detail}`);
  failed += 1;
}

async function testDatabaseConnection() {
  console.log('\n[1/5] Central database connection');
  try {
    const r = await centralPool.query('SELECT 1 AS ok');
    if (r.rows[0].ok === 1) {
      pass(`Connected to ${process.env.DB_NAME || 'cisodashboard'} on ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
    } else {
      fail('SELECT 1 returned unexpected value');
    }
  } catch (e) {
    fail('Cannot reach the database', e.message);
    throw e;
  }
}

async function testUsersTable() {
  console.log('\n[2/5] Users table');
  try {
    const r = await centralPool.query('SELECT username, role, org_ids FROM users ORDER BY id');
    if (r.rows.length === 0) {
      fail('users table is empty', 'Run setup.sql in pgAdmin against the cisodashboard database.');
      return;
    }
    pass(`Found ${r.rows.length} user(s):`);
    r.rows.forEach((u) => {
      console.log(`        - ${u.username.padEnd(10)} (${u.role.padEnd(11)}) orgs=${JSON.stringify(u.org_ids)}`);
    });
  } catch (e) {
    if (e.code === '42P01') {
      fail('users table does not exist', 'Run setup.sql in pgAdmin against the cisodashboard database.');
    } else {
      fail('Error reading users', e.message);
    }
  }
}

async function testOrganisationsTable() {
  console.log('\n[3/5] Organisations table');
  try {
    const r = await centralPool.query('SELECT id, org_name FROM organisations ORDER BY id');
    if (r.rows.length === 0) {
      fail('organisations table is empty', 'Run schema.sql in pgAdmin.');
      return;
    }
    pass(`Found ${r.rows.length} organisation(s):`);
    r.rows.forEach((o) => console.log(`        - #${o.id}  ${o.org_name}`));
    return r.rows;
  } catch (e) {
    if (e.code === '42P01') {
      fail('organisations table does not exist', 'Run schema.sql in pgAdmin.');
    } else {
      fail('Error reading organisations', e.message);
    }
    return [];
  }
}

async function testOrgDatabases(orgs) {
  console.log('\n[4/5] Per-org databases (ciso_org_<id>)');
  const { Client } = require('pg');
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'root',
  });
  await client.connect();
  try {
    for (const o of orgs) {
      const dbName = `ciso_org_${o.id}`;
      const r = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
      if (r.rows.length === 0) {
        fail(`Database ${dbName} missing`, 'Start the backend once — it creates these automatically.');
      } else {
        pass(`Database ${dbName} exists`);
      }
    }
  } finally {
    await client.end();
  }
}

function testAuthRoute() {
  console.log('\n[5/5] Auth route /api/auth/check-username');
  return new Promise((resolve) => {
    const body = JSON.stringify({ username: 'Shubham' });
    const req = http.request(
      {
        host: 'localhost',
        port: PORT,
        path: '/api/auth/check-username',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              if (json.exists === true && Array.isArray(json.organisations)) {
                pass(`Returns exists=true with ${json.organisations.length} org(s)`);
              } else if (json.exists === false) {
                fail('Returns exists=false for Shubham', 'users table is missing Shubham. Re-run schema.sql.');
              } else {
                fail('Unexpected response shape', JSON.stringify(json));
              }
            } catch (e) {
              fail('Response is not JSON', data.slice(0, 200));
            }
          } else if (res.statusCode === 500) {
            fail(`Server returned 500`, data);
          } else {
            fail(`HTTP ${res.statusCode}`, data);
          }
          resolve();
        });
      }
    );
    req.on('error', (e) => {
      if (e.code === 'ECONNREFUSED') {
        fail(`Cannot connect to backend on http://localhost:${PORT}`, 'Start the backend with: cd backend && npm run dev');
      } else {
        fail('Network error', e.message);
      }
      resolve();
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== CISO Backend Diagnostic ===');
  console.log(`    DB: ${process.env.DB_NAME || 'cisodashboard'} on ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
  console.log(`    API: http://localhost:${PORT}/api/health`);

  try {
    await testDatabaseConnection();
    await testUsersTable();
    const orgs = await testOrganisationsTable();
    if (orgs.length) await testOrgDatabases(orgs);
  } catch (e) {
    // DB connection itself failed — can't continue.
  }

  await testAuthRoute();
  await centralPool.end();

  console.log('\n=== Summary ===');
  if (failed === 0) {
    console.log('🎉 All checks passed. The backend is healthy.');
    console.log('   If the login page STILL shows an error, the problem is on the frontend:');
    console.log('   - Is the frontend dev server running? (cd frontend && npm run dev)');
    console.log('   - Open browser DevTools → Console for the axios error details.');
  } else {
    console.log(`❌ ${failed} check(s) failed. Read the messages above and fix them in order.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Diagnostic crashed:', e);
  process.exit(1);
});