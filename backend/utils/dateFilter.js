/**
 * Validates a date string in YYYY-MM-DD format.
 */
function isValidDateParam(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value).getTime());
}

/**
 * Filters a cached firewall report's row data by a date range.
 * Supports both array-of-rows and { table: { rows } } shapes.
 */
function filterReportDataByDateRange(data, startDate, endDate) {
  if (!data || (!startDate && !endDate)) return data;

  const start = startDate ? new Date(startDate) : null;
  const end   = endDate   ? new Date(endDate + 'T23:59:59') : null;

  const DATE_KEYS = ['time', 'date', 'timestamp', 'generated_time', 'receive_time'];

  function filterRows(rows) {
    if (!Array.isArray(rows)) return rows;
    return rows.filter(row => {
      const raw = DATE_KEYS.map(k => row[k]).find(v => v != null);
      if (!raw) return true; // keep rows with no date field
      const d = new Date(typeof raw === 'string' ? raw.replace(' ', 'T') : raw);
      if (isNaN(d.getTime())) return true;
      if (start && d < start) return false;
      if (end   && d > end)   return false;
      return true;
    });
  }

  // Handle { table: { rows, columns } } shape
  if (data && typeof data === 'object' && data.table) {
    return { ...data, table: { ...data.table, rows: filterRows(data.table.rows) } };
  }

  // Handle plain array
  if (Array.isArray(data)) return filterRows(data);

  return data;
}

module.exports = { isValidDateParam, filterReportDataByDateRange };
