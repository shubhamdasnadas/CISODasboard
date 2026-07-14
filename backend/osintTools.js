// Central definition of the OSINT tools shown on the OSINT Intel page.
// Mirrors the request shapes already validated in /test/*.py — same sample
// lookups, same auth mechanisms. This file is additive/new; it does not
// modify the existing generic apiTokens/apiResponses route logic.
//
// `needsKey: false` tools are called with no credential at all.
// `authType` describes HOW a stored api_tokens.token value (looked up by
// api_name === tool.id) gets attached, when one exists.
//
// `buildRequest(targets)` receives a fully-populated targets object built
// by routes/osint.js from the org's osint_watchlist (falling back to the
// same sample values used before the watchlist existed), so tools never
// need to null-check `targets` — an org with an empty watchlist gets
// identical behaviour to the old hardcoded queries.
// targets shape: { domain, ip, keyword, keywordPerson, url }

const OSINT_TOOLS = [
  // ── No API key required ──────────────────────────────────────────────
  {
    id: 'OSV', label: 'OSV Vulnerability Library', needsKey: false, authType: 'none', category: 'Vulnerability',
    description: 'Known vulnerabilities for open-source packages, by name/version/ecosystem.',
    buildRequest: () => ({
      method: 'post',
      url: 'https://api.osv.dev/v1/query',
      data: { package: { name: 'axios', ecosystem: 'npm' }, version: '1.7.2' },
    }),
    postProcess: (data) => {
      const vulns = Array.isArray(data?.vulns) ? data.vulns : [];
      return {
        vulnCount: vulns.length,
        vulns: vulns.slice(0, 20).map((v) => ({
          id: v.id,
          summary: (v.summary || '').slice(0, 200),
          severity: v.severity?.[0]?.score || null,
        })),
      };
    },
  },
  {
    id: 'CrtSh', label: 'crt.sh', needsKey: false, authType: 'none', category: 'Attack Surface',
    description: 'Certificate-transparency log search — discovers subdomains from issued SSL certs.',
    timeoutMs: 25000, // crt.sh's cert-transparency search is slow for domains with many certs
    buildRequest: (targets) => ({
      method: 'get',
      url: 'https://crt.sh/',
      params: { q: targets.domain, output: 'json' },
    }),
    postProcess: (data) => {
      const rows = Array.isArray(data) ? data : [];
      const subdomains = [...new Set(rows.flatMap((r) => String(r.name_value || '').split('\n')))].sort();
      const issuers = {};
      rows.forEach((r) => {
        const iss = r.issuer_name || 'Unknown';
        issuers[iss] = (issuers[iss] || 0) + 1;
      });
      return {
        certCount: rows.length,
        subdomainCount: subdomains.length,
        subdomains: subdomains.slice(0, 50),
        issuers,
      };
    },
  },
  {
    id: 'MitreAttack', label: 'MITRE ATT&CK', needsKey: false, authType: 'none', category: 'Vulnerability',
    description: 'Adversary tactics/techniques reference (STIX dataset) — sample technique T1566 (Phishing).',
    buildRequest: () => ({
      method: 'get',
      url: 'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json',
    }),
    // The full bundle is large — keep only the sample technique so cached
    // rows (and API responses) stay small, same trimming as the test script.
    postProcess: (data) => {
      const objects = Array.isArray(data?.objects) ? data.objects : [];
      const match = objects.find(
        (o) => o.type === 'attack-pattern' &&
          (o.external_references || []).some((r) => r.external_id === 'T1566')
      );
      return match
        ? { technique_id: 'T1566', name: match.name, description: (match.description || '').slice(0, 500) }
        : { note: 'Technique T1566 not found in bundle' };
    },
  },
  {
    id: 'PhishStats', label: 'PhishStats', needsKey: false, authType: 'none', category: 'Phishing/Brand',
    description: 'Recent phishing URLs matching your brand/domain keyword.',
    buildRequest: (targets) => ({
      method: 'get',
      url: 'https://api.phishstats.info/api/phishing',
      params: { _where: `(url,like,~${targets.keyword}~)`, _size: 5 },
    }),
    postProcess: (data) => {
      const rows = Array.isArray(data) ? data : [];
      return {
        incidentCount: rows.length,
        samples: rows.slice(0, 10).map((r) => ({ url: r.url, date: r.date, score: r.score })),
      };
    },
  },
  {
    id: 'OpenPhish', label: 'OpenPhish Feed', needsKey: false, authType: 'none', category: 'Phishing/Brand',
    description: 'Free community feed of confirmed active phishing URLs.',
    buildRequest: () => ({ method: 'get', url: 'https://openphish.com/feed.txt' }),
    postProcess: (data) => {
      const lines = String(data).trim().split('\n').filter(Boolean);
      return { total_urls: lines.length, sample: lines.slice(0, 5) };
    },
  },
  {
    id: 'NVD', label: 'NVD (NIST)', needsKey: false, authType: 'header', category: 'Vulnerability',
    description: 'Official NIST CVE database — severity, score, and description for a given CVE.',
    headerName: 'apiKey', // attached opportunistically if a token exists; never required
    buildRequest: () => ({
      method: 'get',
      url: 'https://services.nvd.nist.gov/rest/json/cves/2.0',
      params: { cveId: 'CVE-2021-44228' },
    }),
    postProcess: (data) => {
      const item = data?.vulnerabilities?.[0]?.cve;
      const metric = item?.metrics?.cvssMetricV31?.[0] || item?.metrics?.cvssMetricV30?.[0] || item?.metrics?.cvssMetricV2?.[0];
      return {
        cveId: item?.id || null,
        baseScore: metric?.cvssData?.baseScore ?? null,
        baseSeverity: metric?.cvssData?.baseSeverity || metric?.baseSeverity || null,
        description: (item?.descriptions?.find((d) => d.lang === 'en')?.value || '').slice(0, 300),
      };
    },
  },
  {
    id: 'UrlScan', label: 'urlscan.io (search)', needsKey: false, authType: 'none', category: 'Attack Surface',
    description: 'Searches previously submitted URL scans (screenshots, DNS, certs) for your domain.',
    timeoutMs: 25000, // urlscan.io's search can be slow for domains with a lot of scan history
    buildRequest: (targets) => ({
      method: 'get',
      url: 'https://urlscan.io/api/v1/search/',
      params: { q: `domain:${targets.domain}` },
    }),
    postProcess: (data) => {
      const results = Array.isArray(data?.results) ? data.results : [];
      const countries = {};
      const scansByDay = {};
      results.forEach((r) => {
        const country = r.page?.country || 'Unknown';
        countries[country] = (countries[country] || 0) + 1;
        const day = r.task?.time ? String(r.task.time).slice(0, 10) : null;
        if (day) scansByDay[day] = (scansByDay[day] || 0) + 1;
      });
      return {
        totalScans: data?.total ?? results.length,
        countryCount: Object.keys(countries).length,
        countries,
        scansByDay,
        recent: results.slice(0, 10).map((r) => ({
          time: r.task?.time || null,
          ip: r.page?.ip || null,
          country: r.page?.country || null,
          status: r.page?.status || null,
          server: r.page?.server || null,
        })),
      };
    },
  },

  // ── Single header API key ────────────────────────────────────────────
  {
    id: 'AlienVaultOTX', label: 'AlienVault OTX', needsKey: true, authType: 'header', headerName: 'X-OTX-API-KEY', category: 'Threat/IP Reputation',
    description: 'Community threat-intel pulses referencing a given IP address.',
    buildRequest: (targets) => ({ method: 'get', url: `https://otx.alienvault.com/api/v1/indicators/IPv4/${targets.ip}/general` }),
  },
  {
    id: 'GreyNoise', label: 'GreyNoise', needsKey: true, authType: 'header', headerName: 'key', category: 'Threat/IP Reputation',
    description: 'Distinguishes targeted attacks from benign internet background-noise scanners.',
    buildRequest: (targets) => ({ method: 'get', url: `https://api.greynoise.io/v3/community/${targets.ip}` }),
  },
  {
    id: 'VirusTotal', label: 'VirusTotal', needsKey: true, authType: 'header', headerName: 'x-apikey', category: 'Attack Surface',
    description: 'Multi-engine malicious/suspicious verdict and reputation score for a domain.',
    buildRequest: (targets) => ({ method: 'get', url: `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(targets.domain)}` }),
    postProcess: (data) => {
      const stats = data?.data?.attributes?.last_analysis_stats || {};
      return {
        malicious: stats.malicious || 0,
        suspicious: stats.suspicious || 0,
        harmless: stats.harmless || 0,
        undetected: stats.undetected || 0,
        timeout: stats.timeout || 0,
        reputation: data?.data?.attributes?.reputation ?? null,
      };
    },
  },
  {
    id: 'Onyphe', label: 'Onyphe', needsKey: true, authType: 'header', headerName: 'Authorization', headerPrefix: 'apikey ', category: 'Threat/IP Reputation',
    description: 'Exposed services, vulnerabilities, and certificates observed for an IP.',
    buildRequest: (targets) => ({ method: 'get', url: `https://www.onyphe.io/api/v2/summary/ip/${targets.ip}` }),
  },
  {
    id: 'Netlas', label: 'Netlas.io', needsKey: true, authType: 'header', headerName: 'X-API-Key', category: 'Attack Surface',
    description: 'Internet-wide host scan data — open ports, services, certs, WHOIS.',
    buildRequest: (targets) => ({ method: 'get', url: 'https://app.netlas.io/api/host/', params: { q: targets.ip } }),
  },
  {
    id: 'BinaryEdge', label: 'BinaryEdge', needsKey: true, authType: 'header', headerName: 'X-Key', category: 'Attack Surface',
    description: 'Commercial internet-scanning results (banners, open ports) for an IP.',
    buildRequest: (targets) => ({ method: 'get', url: `https://api.binaryedge.io/v2/query/ip/${targets.ip}` }),
  },
  {
    id: 'Maltiverse', label: 'Maltiverse', needsKey: true, authType: 'header', headerName: 'Authorization', headerPrefix: 'Bearer ', category: 'Threat/IP Reputation',
    description: 'Threat score and context for an IP indicator.',
    buildRequest: (targets) => ({ method: 'get', url: `https://api.maltiverse.com/ip/${targets.ip}` }),
  },
  {
    id: 'OpenSanctions', label: 'OpenSanctions', needsKey: true, authType: 'header', headerName: 'Authorization', headerPrefix: 'ApiKey ', category: 'Compliance/Sanctions',
    description: 'Screens a name against global sanctions and politically-exposed-person lists.',
    buildRequest: (targets) => ({ method: 'get', url: 'https://api.opensanctions.org/search/default', params: { q: targets.keywordPerson } }),
    postProcess: (data) => {
      const results = Array.isArray(data?.results) ? data.results : [];
      return {
        matchCount: results.length,
        matches: results.slice(0, 10).map((r) => ({
          name: r.caption,
          score: r.score,
          datasets: r.datasets,
          topic: r.properties?.topics?.[0] || null,
        })),
      };
    },
  },

  // ── Query-param API key ──────────────────────────────────────────────
  {
    id: 'Shodan', label: 'Shodan', needsKey: true, authType: 'query', paramName: 'key', category: 'Threat/IP Reputation',
    description: 'Open ports, banners, and known vulnerabilities exposed on an IP.',
    buildRequest: (targets) => ({ method: 'get', url: `https://api.shodan.io/shodan/host/${targets.ip}` }),
    postProcess: (data) => ({
      ports: Array.isArray(data?.ports) ? data.ports : [],
      vulnCount: data?.vulns ? Object.keys(data.vulns).length : 0,
      vulns: data?.vulns ? Object.keys(data.vulns).slice(0, 20) : [],
      org: data?.org || null,
      isp: data?.isp || null,
      hostnames: data?.hostnames || [],
    }),
  },
  {
    id: 'Pulsedive', label: 'Pulsedive', needsKey: true, authType: 'query', paramName: 'key', category: 'Threat/IP Reputation',
    description: 'Enrichment and risk score for an IOC/indicator.',
    buildRequest: (targets) => ({ method: 'get', url: 'https://pulsedive.com/api/info.php', params: { indicator: targets.ip } }),
  },

  // ── HTTP Basic auth, two credentials (token stored as "id:secret") ───
  {
    id: 'Censys', label: 'Censys', needsKey: true, authType: 'basic', keyFields: 2, category: 'Attack Surface',
    description: 'Host/certificate/service search across the internet.',
    buildRequest: () => ({
      method: 'get',
      url: 'https://search.censys.io/api/v2/hosts/search',
      params: { q: 'services.service_name: HTTP', per_page: 5 },
    }),
  },

  // ── Credential goes in a form field, not a header/query/basic ────────
  {
    id: 'PhishTank', label: 'PhishTank', needsKey: true, authType: 'formField', fieldName: 'app_key', category: 'Phishing/Brand',
    description: 'Checks a URL against a community-verified phishing database.',
    buildRequest: (targets) => ({
      method: 'post',
      url: 'https://checkurl.phishtank.com/checkurl/',
      form: { url: targets.url, format: 'json' },
    }),
  },
];

module.exports = { OSINT_TOOLS };
