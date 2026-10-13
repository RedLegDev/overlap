/** ISO calendar date (YYYY-MM-DD) plus whole days. */
export function addDays(isoDate: string, n: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** Shift date-poll days forward by at least one week, until the first date is on or after today. */
export function shiftDatesForRerun(dates: string[], today: string) {
  const sorted = [...dates].sort();
  if (!sorted.length) return sorted;
  const first = sorted[0];
  let weeks = 1;
  while (addDays(first, weeks * 7) < today) weeks += 1;
  const shift = weeks * 7;
  return sorted.map((d) => addDays(d, shift));
}
