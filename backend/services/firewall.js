const axios = require('axios');
const https = require('https');
const { XMLParser } = require('fast-xml-parser');
const { getOrgPool } = require('../db');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const agent = new https.Agent({ rejectUnauthorized: false });

const REPORTS = [
  'bandwidth-trend',
  'risk-trend',
  'risky-users',
  'spyware-infected-hosts',
  'threat-trend',
  'top-application-categories',
  'top-applications',
  'top-attacker-destinations',
  'top-attacker-sources',
  'top-attackers-by-destination-countries',
  'top-attacks',
  'top-blocked-url-categories',
  'top-blocked-url-user-behavior',
  'top-blocked-url-users',
  'top-blocked-websites',
  'top-connections',
  'top-denied-applications',
  'top-denied-destinations',
  'top-denied-sources',
  'top-destination-countries',
  'top-destinations',
  'top-http-applications',
  'top-source-countries',
  'top-sources',
  'top-spyware-threats',
  'top-technology-categories',
  'top-url-categories',
  'top-url-user-behavior',
  'top-url-users',
  'top-users',
  'top-victim-destinations',
  'top-victim-sources',
  'top-victims-by-destination-countries',
  'top-viruses',
  'top-vulnerabilities',
  'top-websites',
];

async function syncFirewall(orgSlug, creds) {
  const baseUrl = creds.baseUrl.replace(/\/$/, '');
  const apiKey = creds.apiKey;
  const pool = getOrgPool(orgSlug);

  console.log(`[FW sync][org=${orgSlug}] Starting collection of ${REPORTS.length} reports`);

  let successCount = 0;
  for (const report of REPORTS) {
    try {
      const url = `${baseUrl}/api/?type=report&reportname=${report}&key=${apiKey}`;
      const response = await axios.get(url, { httpsAgent: agent });
      const json = parser.parse(response.data);

      await pool.query(
        `INSERT INTO firewall_reports (report_name, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (report_name) DO UPDATE SET
           data       = EXCLUDED.data,
           updated_at = EXCLUDED.updated_at`,
        [report, JSON.stringify(json)]
      );
      successCount++;
    } catch (err) {
      console.error(`[FW sync][org=${orgSlug}] Error on ${report}:`, err.message);
    }
  }

  console.log(`[FW sync][org=${orgSlug}] Done — ${successCount}/${REPORTS.length} reports saved`);
  return { success: successCount, total: REPORTS.length, syncedAt: new Date().toISOString() };
}

module.exports = { syncFirewall, REPORTS };
