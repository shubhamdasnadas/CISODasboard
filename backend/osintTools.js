// Central definition of the OSINT tools shown on the OSINT Intel page.
// Mirrors the request shapes already validated in /test/*.py — same sample
// lookups, same auth mechanisms. This file is additive/new; it does not
// modify the existing generic apiTokens/apiResponses route logic.
//
// `needsKey: false` tools are called with no credential at all.
// `authType` describes HOW a stored api_tokens.token value (looked up by
// api_name === tool.id) gets attached, when one exists.

const OSINT_TOOLS = [
  // ── No API key required ──────────────────────────────────────────────
  {
    id: 'OSV', label: 'OSV Vulnerability Library', needsKey: false, authType: 'none',
    buildRequest: () => ({
      method: 'post',
      url: 'https://api.osv.dev/v1/query',
      data: { package: { name: 'axios', ecosystem: 'npm' }, version: '1.7.2' },
    }),
  },
  {
    id: 'CrtSh', label: 'crt.sh', needsKey: false, authType: 'none',
    buildRequest: () => ({
      method: 'get',
      url: 'https://crt.sh/',
      params: { q: 'example.com', output: 'json' },
    }),
  },
  {
    id: 'MitreAttack', label: 'MITRE ATT&CK', needsKey: false, authType: 'none',
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
    id: 'PhishStats', label: 'PhishStats', needsKey: false, authType: 'none',
    buildRequest: () => ({
      method: 'get',
      url: 'https://api.phishstats.info/api/phishing',
      params: { _where: '(url,like,~yourcompany~)', _size: 5 },
    }),
  },
  {
    id: 'OpenPhish', label: 'OpenPhish Feed', needsKey: false, authType: 'none',
    buildRequest: () => ({ method: 'get', url: 'https://openphish.com/feed.txt' }),
    postProcess: (data) => {
      const lines = String(data).trim().split('\n').filter(Boolean);
      return { total_urls: lines.length, sample: lines.slice(0, 5) };
    },
  },
  {
    id: 'NVD', label: 'NVD (NIST)', needsKey: false, authType: 'header',
    headerName: 'apiKey', // attached opportunistically if a token exists; never required
    buildRequest: () => ({
      method: 'get',
      url: 'https://services.nvd.nist.gov/rest/json/cves/2.0',
      params: { cveId: 'CVE-2021-44228' },
    }),
  },
  {
    id: 'UrlScan', label: 'urlscan.io (search)', needsKey: false, authType: 'none',
    buildRequest: () => ({
      method: 'get',
      url: 'https://urlscan.io/api/v1/search/',
      params: { q: 'domain:example.com' },
    }),
  },

  // ── Single header API key ────────────────────────────────────────────
  {
    id: 'AlienVaultOTX', label: 'AlienVault OTX', needsKey: true, authType: 'header', headerName: 'X-OTX-API-KEY',
    buildRequest: () => ({ method: 'get', url: 'https://otx.alienvault.com/api/v1/indicators/IPv4/8.8.8.8/general' }),
  },
  {
    id: 'GreyNoise', label: 'GreyNoise', needsKey: true, authType: 'header', headerName: 'key',
    buildRequest: () => ({ method: 'get', url: 'https://api.greynoise.io/v3/community/8.8.8.8' }),
  },
  {
    id: 'VirusTotal', label: 'VirusTotal', needsKey: true, authType: 'header', headerName: 'x-apikey',
    buildRequest: () => ({ method: 'get', url: 'https://www.virustotal.com/api/v3/domains/example.com' }),
  },
  {
    id: 'Onyphe', label: 'Onyphe', needsKey: true, authType: 'header', headerName: 'Authorization', headerPrefix: 'apikey ',
    buildRequest: () => ({ method: 'get', url: 'https://www.onyphe.io/api/v2/summary/ip/8.8.8.8' }),
  },
  {
    id: 'Netlas', label: 'Netlas.io', needsKey: true, authType: 'header', headerName: 'X-API-Key',
    buildRequest: () => ({ method: 'get', url: 'https://app.netlas.io/api/host/', params: { q: '8.8.8.8' } }),
  },
  {
    id: 'BinaryEdge', label: 'BinaryEdge', needsKey: true, authType: 'header', headerName: 'X-Key',
    buildRequest: () => ({ method: 'get', url: 'https://api.binaryedge.io/v2/query/ip/8.8.8.8' }),
  },
  {
    id: 'Maltiverse', label: 'Maltiverse', needsKey: true, authType: 'header', headerName: 'Authorization', headerPrefix: 'Bearer ',
    buildRequest: () => ({ method: 'get', url: 'https://api.maltiverse.com/ip/8.8.8.8' }),
  },
  {
    id: 'OpenSanctions', label: 'OpenSanctions', needsKey: true, authType: 'header', headerName: 'Authorization', headerPrefix: 'ApiKey ',
    buildRequest: () => ({ method: 'get', url: 'https://api.opensanctions.org/search/default', params: { q: 'Vladimir Putin' } }),
  },
  {
    id: 'IntelligenceX', label: 'IntelligenceX', needsKey: true, authType: 'header', headerName: 'x-key',
    // Simplified vs. the two-step test script: returns the submission/search-id
    // response only (no polling), so this stays a single fast request.
    buildRequest: () => ({
      method: 'post',
      url: 'https://2.intelx.io/intelligent/search',
      data: { term: 'example.com', maxresults: 5, media: 0, sort: 4 },
    }),
  },

  // ── Query-param API key ──────────────────────────────────────────────
  {
    id: 'Shodan', label: 'Shodan', needsKey: true, authType: 'query', paramName: 'key',
    buildRequest: () => ({ method: 'get', url: 'https://api.shodan.io/shodan/host/8.8.8.8' }),
  },
  {
    id: 'Pulsedive', label: 'Pulsedive', needsKey: true, authType: 'query', paramName: 'key',
    buildRequest: () => ({ method: 'get', url: 'https://pulsedive.com/api/info.php', params: { indicator: '8.8.8.8' } }),
  },

  // ── HTTP Basic auth, two credentials (token stored as "id:secret") ───
  {
    id: 'Censys', label: 'Censys', needsKey: true, authType: 'basic', keyFields: 2,
    buildRequest: () => ({
      method: 'get',
      url: 'https://search.censys.io/api/v2/hosts/search',
      params: { q: 'services.service_name: HTTP', per_page: 5 },
    }),
  },

  // ── Credential goes in a form field, not a header/query/basic ────────
  {
    id: 'PhishTank', label: 'PhishTank', needsKey: true, authType: 'formField', fieldName: 'app_key',
    buildRequest: () => ({
      method: 'post',
      url: 'https://checkurl.phishtank.com/checkurl/',
      form: { url: 'http://example.com/', format: 'json' },
    }),
  },
];

module.exports = { OSINT_TOOLS };
