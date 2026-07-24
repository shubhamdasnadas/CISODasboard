const { getOrgPool } = require('../db');

const ZOHO_BASE_URL = 'https://accounts.zoho.in/oauth/v2/token';

/**
 * Exchange a stored refresh token for a short-lived Zoho access token.
 * @param {Object} creds - Credentials object with clientId, clientSecret, refreshToken, dc
 * @returns {Promise<string>} - Access token
 */
async function getZohoAccessToken(creds) {
  const dc = creds.dc || 'in';
  const tokenUrl = `https://accounts.zoho.${dc}/oauth/v2/token`;

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('client_id', creds.clientId);
  params.append('client_secret', creds.clientSecret);
  params.append('refresh_token', creds.refreshToken);

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    throw new Error(`Zoho token exchange failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

/**
 * Sync Zoho tickets for an organization.
 * @param {string} orgSlug - Organization slug
 * @param {Object} creds - Zoho credentials
 * @returns {Promise<Object>} - Sync result with fetched, upserted, totalInDb counts
 */
async function syncZohoTickets(orgSlug, creds) {
  const pool = getOrgPool(orgSlug);

  // Get access token from refresh token
  const accessToken = await getZohoAccessToken(creds);

  const domain = creds.domain || `https://desk.zoho.${creds.dc || 'in'}`;
  const orgId = creds.orgId;

  const allTickets = [];
  let page = 1;
  const limit = 100;

  // Paginate through tickets
  while (true) {
    const url = `${domain}/api/v1/tickets?include=contacts,assignee,departments,team,isRead&limit=${limit}&page=${page}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        orgId,
        Accept: 'application/json',
      },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(`Zoho API failed (page ${page}, ${res.status}): ${JSON.stringify(data)}`);
    }

    if (!data) {
      throw new Error('Empty response from Zoho API');
    }

    const tickets = data.data || [];
    allTickets.push(...tickets);

    // Break if we've fetched all available tickets
    if (tickets.length < limit || page >= (data.pageCount || 1)) {
      break;
    }

    page++;
  }

  // Store tickets in zohotable
  await pool.query(`
    CREATE TABLE IF NOT EXISTS zohotable (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      data_name  TEXT        NOT NULL UNIQUE,
      data       JSONB       NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(
    `INSERT INTO zohotable (data_name, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (data_name) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    ['tickets', JSON.stringify(allTickets)]
  );

  // Get total count from DB
  const { rows } = await pool.query('SELECT COUNT(*) FROM zohotable WHERE data_name = $1', ['tickets']);
  const totalInDb = parseInt(rows[0].count, 10);

  console.log(`[Zoho sync][org=${orgSlug}] Fetched ${allTickets.length} tickets, total in DB: ${totalInDb}`);

  return {
    fetched: allTickets.length,
    totalInDb,
    syncedAt: new Date().toISOString(),
  };
}

module.exports = { syncZohoTickets, getZohoAccessToken };