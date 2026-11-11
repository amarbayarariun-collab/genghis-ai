/**
 * UTC calendar-month helpers for plan quotas.
 */

/** First day of current UTC calendar month (YYYY-MM-01). */
export function monthStartUtc(d = new Date()): string {
  return `${d.toISOString().slice(0, 7)}-01`;
}

/** UTC month key YYYY-MM. */
export function monthKeyUtc(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

/**
 * First day of the next UTC calendar month (YYYY-MM-DD).
 * Quota counters reset at 00:00 UTC on this date.
 */
export function monthResetsAtUtc(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const next =
    m === 11
      ? new Date(Date.UTC(y + 1, 0, 1))
      : new Date(Date.UTC(y, m + 1, 1));
  return next.toISOString().slice(0, 10);
}

/** Next-month reset date from a YYYY-MM period key. */
export function monthResetsAtFromPeriod(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) return monthResetsAtUtc();
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return monthResetsAtUtc();
  }
  const next =
    m === 12
      ? new Date(Date.UTC(y + 1, 0, 1))
      : new Date(Date.UTC(y, m, 1));
  return next.toISOString().slice(0, 10);
}
