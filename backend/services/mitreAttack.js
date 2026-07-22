const axios = require('axios');

const STIX_BUNDLE_URL = 'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // ATT&CK data changes rarely — refetch at most daily

let cache = null; // { fetchedAt, techniques: { [techniqueId]: { id, name, description } } }
let inFlight = null;

function firstSentences(text, maxLen = 220) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen);
  const lastPeriod = cut.lastIndexOf('. ');
  return (lastPeriod > 60 ? cut.slice(0, lastPeriod + 1) : cut.trim() + '…');
}

function buildTechniqueMap(bundle) {
  const objects = Array.isArray(bundle?.objects) ? bundle.objects : [];
  const techniques = {};
  objects.forEach((o) => {
    if (o.type !== 'attack-pattern' || o.revoked || o.x_mitre_deprecated) return;
    const ref = (o.external_references || []).find((r) => r.source_name === 'mitre-attack' && /^T\d+/.test(r.external_id || ''));
    if (!ref) return;
    techniques[ref.external_id] = {
      id: ref.external_id,
      name: o.name,
      description: firstSentences(o.description),
    };
  });
  return techniques;
}

/**
 * Returns { [techniqueId]: { id, name, description } } for the full
 * enterprise ATT&CK technique set, fetched once and cached in-process
 * (the framework changes rarely, so a daily refresh is plenty).
 */
async function getTechniqueMap() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.techniques;
  }
  if (inFlight) return inFlight;

  inFlight = axios.get(STIX_BUNDLE_URL, { timeout: 30000 })
    .then((res) => {
      const techniques = buildTechniqueMap(res.data);
      cache = { fetchedAt: Date.now(), techniques };
      return techniques;
    })
    .finally(() => { inFlight = null; });

  return inFlight;
}

module.exports = { getTechniqueMap };
