const { getOrgPool } = require('../db');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchAllPages(baseUrl, apiToken, endpoint, extraParams = {}) {
  const all = [];
  let cursor = null;

  do {
    const url = new URL(`${baseUrl}${endpoint}`);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    for (const [k, v] of Object.entries(extraParams)) url.searchParams.set(k, v);

    let res = null;
    for (let retry = 0; retry <= 5; retry++) {
      res = await fetch(url.toString(), {
        headers: { Authorization: `ApiToken ${apiToken}`, Accept: 'application/json' },
      });
      if (res.status !== 429) break;
      const wait =
        Number(res.headers.get('retry-after') || 0) * 1000 ||
        3000 * Math.pow(2, retry);
      console.warn(`[S1 sync] 429 — waiting ${wait}ms`);
      await sleep(wait);
    }

    if (!res || !res.ok) {
      const body = await res?.text();
      throw new Error(`S1 API ${res?.status}: ${body?.slice(0, 200)}`);
    }

    const json = await res.json();
    all.push(...(json?.data ?? []));
    cursor = json?.pagination?.nextCursor ?? null;
    if (cursor) await sleep(300);
  } while (cursor);

  return all;
}

async function syncSentinelOne(orgId, creds) {
  const baseUrl = (creds.baseUrl || process.env.S1_BASE_URL)?.replace(/\/$/, '');
  const apiToken = creds.tokenKey;

  if (!baseUrl || !apiToken) {
    throw new Error('SentinelOne not configured — provide tokenKey/baseUrl');
  }

  const pool = getOrgPool(orgId);

  console.log(`[S1 sync][org=${orgId}] Fetching threats...`);
  const threats = await fetchAllPages(baseUrl, apiToken, '/web/api/v2.1/threats');
  console.log(`[S1 sync][org=${orgId}] Got ${threats.length} threats`);

  console.log(`[S1 sync][org=${orgId}] Fetching agents...`);
  const agents = await fetchAllPages(baseUrl, apiToken, '/web/api/v2.1/agents');
  console.log(`[S1 sync][org=${orgId}] Got ${agents.length} agents`);

  console.log(`[S1 sync][org=${orgId}] Fetching application CVE risks...`);
  let cves = [];
  try {
    const cveParams = creds.accountId ? { accountIds: creds.accountId } : {};
    cves = await fetchAllPages(baseUrl, apiToken, '/web/api/v2.1/application-management/risks', cveParams);
    console.log(`[S1 sync][org=${orgId}] Got ${cves.length} CVE risk records`);
  } catch (e) {
    console.warn(`[S1 sync][org=${orgId}] CVE risks fetch failed (non-fatal): ${e.message}`);
  }

  await pool.query('TRUNCATE TABLE s1_threats');
  for (const t of threats) {
    const id = t.id || null;
    await pool.query(
      `INSERT INTO s1_threats (threat_id, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (threat_id) DO UPDATE SET data = EXCLUDED.data, synced_at = NOW()`,
      [id, JSON.stringify(t)]
    );
  }

  await pool.query('TRUNCATE TABLE s1_agents');
  for (const a of agents) {
    const id = a.id || null;
    await pool.query(
      `INSERT INTO s1_agents (agent_id, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (agent_id) DO UPDATE SET data = EXCLUDED.data, synced_at = NOW()`,
      [id, JSON.stringify(a)]
    );
  }

  if (cves.length > 0) {
    await pool.query('TRUNCATE TABLE s1_application_cve');
    for (const c of cves) {
      const id = c.applicationId || c.id || c.cveId || null;
      await pool.query(
        `INSERT INTO s1_application_cve (cve_id, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (cve_id) DO UPDATE SET data = EXCLUDED.data, synced_at = NOW()`,
        [id, JSON.stringify(c)]
      );
    }
  }

  console.log(`[S1 sync][org=${orgId}] Done.`);
  return { threats: threats.length, agents: agents.length, cves: cves.length, syncedAt: new Date().toISOString() };
}

module.exports = { syncSentinelOne };
