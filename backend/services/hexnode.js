const { getOrgPool } = require('../db');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractArray(json) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== 'object') return [];
  for (const key of ['devices', 'applications', 'results', 'data']) {
    if (Array.isArray(json[key])) return json[key];
  }
  const firstArray = Object.values(json).find((v) => Array.isArray(v));
  return firstArray || [];
}

async function fetchHexnodePages(baseUrl, apiToken, path, extraParams = {}) {
  const all = [];
  let page = 1;

  while (true) {
    const url = new URL(`${baseUrl}${path}`);
    url.searchParams.set('page', String(page));
    for (const [k, v] of Object.entries(extraParams)) url.searchParams.set(k, v);

    let res = null;
    for (let retry = 0; retry <= 5; retry++) {
      res = await fetch(url.toString(), {
        headers: { Authorization: apiToken, Accept: 'application/json' },
      });
      if (res.status !== 429) break;
      const wait = Number(res.headers.get('retry-after') || 0) * 1000 || 3000 * Math.pow(2, retry);
      console.warn(`[Hexnode sync] 429 — waiting ${wait}ms`);
      await sleep(wait);
    }

    if (!res || !res.ok) {
      if (res?.status === 404 && page > 1) break; // no more pages
      const body = await res?.text();
      throw new Error(`Hexnode API ${res?.status} on ${url.toString()}: ${body?.slice(0, 200)}`);
    }

    const json = await res.json();
    const items = extractArray(json);
    all.push(...items);

    if (items.length === 0) break;
    page += 1;
    await sleep(200);
  }

  return all;
}

async function syncHexnode(orgSlug, creds) {
  const baseUrl = creds.baseUrl?.replace(/\/$/, '');
  const apiToken = creds.apiToken;

  if (!baseUrl || !apiToken) {
    throw new Error('Hexnode not configured — provide baseUrl/apiToken');
  }

  const pool = getOrgPool(orgSlug);

  console.log(`[Hexnode sync][org=${orgSlug}] Fetching devices...`);
  const devices = await fetchHexnodePages(baseUrl, apiToken, '/api/v1/devices/', { order_by: 'desc' });
  console.log(`[Hexnode sync][org=${orgSlug}] Got ${devices.length} devices`);

  console.log(`[Hexnode sync][org=${orgSlug}] Fetching applications...`);
  const applications = await fetchHexnodePages(baseUrl, apiToken, '/api/v1/applications/');
  console.log(`[Hexnode sync][org=${orgSlug}] Got ${applications.length} applications`);

  await pool.query('TRUNCATE TABLE hexnode_devices');
  for (const d of devices) {
    const id = d.id != null ? String(d.id) : null;
    await pool.query(
      `INSERT INTO hexnode_devices (device_id, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (device_id) DO UPDATE SET data = EXCLUDED.data, synced_at = NOW()`,
      [id, JSON.stringify(d)]
    );
  }

  await pool.query('TRUNCATE TABLE hexnode_applications');
  for (const a of applications) {
    const id = a.id != null ? String(a.id) : null;
    await pool.query(
      `INSERT INTO hexnode_applications (app_id, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (app_id) DO UPDATE SET data = EXCLUDED.data, synced_at = NOW()`,
      [id, JSON.stringify(a)]
    );
  }

  console.log(`[Hexnode sync][org=${orgSlug}] Fetching per-device installed applications for ${devices.length} devices...`);
  let deviceApplications = [];
  let deviceAppsError = null;
  try {
    await pool.query('TRUNCATE TABLE hexnode_device_applications');
    for (const d of devices) {
      const deviceId = d.id != null ? String(d.id) : null;
      if (!deviceId) continue;
      const apps = await fetchHexnodePages(baseUrl, apiToken, `/api/v1/devices/${deviceId}/applications/`);
      for (const app of apps) {
        const appKey = String(app.id || app.name || app.package_name || JSON.stringify(app).slice(0, 50));
        await pool.query(
          `INSERT INTO hexnode_device_applications (device_id, app_key, data)
           VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (device_id, app_key) DO UPDATE SET data = EXCLUDED.data, synced_at = NOW()`,
          [deviceId, appKey, JSON.stringify(app)]
        );
      }
      deviceApplications.push(...apps);
      await sleep(200);
    }
    console.log(`[Hexnode sync][org=${orgSlug}] Got ${deviceApplications.length} device-application records`);
  } catch (e) {
    deviceAppsError = e.message;
    console.warn(`[Hexnode sync][org=${orgSlug}] Per-device applications fetch failed (non-fatal): ${e.message}`);
  }

  console.log(`[Hexnode sync][org=${orgSlug}] Done.`);
  return {
    devices: devices.length,
    applications: applications.length,
    deviceApplications: deviceApplications.length,
    deviceAppsError: deviceAppsError || null,
    syncedAt: new Date().toISOString(),
  };
}

module.exports = { syncHexnode };
