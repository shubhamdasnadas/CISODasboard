// Builds DynChart-ready rows from an OSINT tool's response history,
// extracting a single numeric field per fetch for a trend line.
export function historyToTrendRows(history, field) {
  return (history || [])
    .filter((h) => !h.response_data?.error)
    .map((h) => ({
      date: new Date(h.fetched_at).toLocaleDateString(),
      [field]: Number(h.response_data?.data?.[field]) || 0,
    }));
}
