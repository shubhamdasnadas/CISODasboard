// Firewall report entries come back from Panorama as XML-parsed JSON with
// varying date-field names depending on the report type — this mirrors the
// column list the frontend uses (frontend/src/pages/paloalto/PaloAltoPage.jsx)
// so server-side and client-side filtering agree on what counts as a date.
const DATE_FIELDS = ['slabbed-receive_time', 'receive_time', 'time_generated', 'time', 'date', 'updatedAt'];

function isValidDateParam(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

function getEntryDate(entry) {
  for (const field of DATE_FIELDS) {
    const raw = entry?.[field];
    if (raw === undefined || raw === null || raw === '') continue;
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return [v];
  return null;
}

// Reports are cached as full JSON blobs (see backend/services/firewall.js),
// and the upstream shape varies by report type — the `entry` list can sit
// at any of several nesting depths. Find whichever one is actually present.
function findEntryHolder(data) {
  const candidates = [
    () => data?.report?.result,
    () => data?.report?.result?.report,
    () => data?.response?.result?.report,
    () => data?.response?.result,
    () => data?.result?.report,
    () => data?.result,
    () => data,
  ];
  for (const get of candidates) {
    const holder = get();
    if (holder && typeof holder === 'object' && 'entry' in holder) return holder;
  }
  return null;
}

function filterReportDataByDateRange(data, startDate, endDate) {
  if (!data || (!startDate && !endDate)) return data;

  const holder = findEntryHolder(data);
  if (!holder) return data;

  const entries = toArray(holder.entry);
  if (!entries) return data;

  const from = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const to = endDate ? new Date(`${endDate}T23:59:59`) : null;

  const filtered = entries.filter((entry) => {
    const d = getEntryDate(entry);
    if (!d) return true; // keep entries with no recognizable date rather than dropping them
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const clone = JSON.parse(JSON.stringify(data));
  const cloneHolder = findEntryHolder(clone);
  if (cloneHolder) cloneHolder.entry = filtered;
  return clone;
}

module.exports = { filterReportDataByDateRange, isValidDateParam };
