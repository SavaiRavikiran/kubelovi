/**
 * Table column sorting: text (A→Z), number/size (small→large), date (old→new).
 * Used by Explorer tables and LogBrowser file list.
 */
export type SortDirection = "asc" | "desc";

/** Parse human-readable size (e.g. "2.4 MB", "800 KB") to bytes for comparison */
export function parseSizeToBytes(sizeStr: string): number {
  if (!sizeStr || typeof sizeStr !== "string") return 0;
  const s = sizeStr.trim().toUpperCase();
  const match = s.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/);
  if (!match) return 0;
  let n = parseFloat(match[1]);
  const unit = (match[2] || "B").toUpperCase();
  if (unit === "KB") n *= 1024;
  else if (unit === "MB") n *= 1024 * 1024;
  else if (unit === "GB") n *= 1024 * 1024 * 1024;
  else if (unit === "TB") n *= 1024 * 1024 * 1024 * 1024;
  return n;
}

/** Compare two values for table sort: text, number, or date */
export function compareValues(
  a: unknown,
  b: unknown,
  direction: SortDirection,
  type: "text" | "number" | "date" | "size"
): number {
  const mult = direction === "asc" ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1 * mult;
  if (b == null) return -1 * mult;

  if (type === "text") {
    const sa = String(a).toLowerCase();
    const sb = String(b).toLowerCase();
    return mult * sa.localeCompare(sb);
  }
  if (type === "number") {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isNaN(na) && Number.isNaN(nb)) return 0;
    if (Number.isNaN(na)) return 1 * mult;
    if (Number.isNaN(nb)) return -1 * mult;
    return mult * (na - nb);
  }
  if (type === "date") {
    const ta = new Date(String(a)).getTime();
    const tb = new Date(String(b)).getTime();
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1 * mult;
    if (Number.isNaN(tb)) return -1 * mult;
    return mult * (ta - tb);
  }
  if (type === "size") {
    const ba = parseSizeToBytes(String(a));
    const bb = parseSizeToBytes(String(b));
    return mult * (ba - bb);
  }
  return mult * String(a).localeCompare(String(b));
}

/** Infer column type from key and optional value (for Explorer generic tables) */
export function inferColumnType(
  columnKey: string,
  value?: unknown
): "text" | "number" | "date" | "size" {
  const key = columnKey.toLowerCase();
  if (
    key.includes("size") ||
    key === "capacity" ||
    (typeof value === "string" && /^[\d.]+\s*(B|KB|MB|GB|TB)$/i.test(value))
  )
    return "size";
  if (
    key.includes("date") ||
    key.includes("age") ||
    key === "lastupdated" ||
    key === "creationtimestamp" ||
    key === "lastschedule"
  )
    return "date";
  if (
    key.includes("count") ||
    key.includes("replicas") ||
    key.includes("nodes") ||
    key.includes("pods") ||
    key.includes("workloads") ||
    key.includes("alerts") ||
    key.includes("warnings") ||
    key === "ready" ||
    key === "desired" ||
    key === "current" ||
    key === "completions" ||
    key === "restarts" ||
    key === "datakeys"
  )
    return "number";
  return "text";
}

/** Sort an array of row objects by a column */
export function sortTableData<T extends Record<string, unknown>>(
  data: T[],
  column: string,
  direction: SortDirection,
  type?: "text" | "number" | "date" | "size"
): T[] {
  const inferred = type ?? inferColumnType(column, data[0]?.[column]);
  return [...data].sort((rowA, rowB) =>
    compareValues(rowA[column], rowB[column], direction, inferred)
  );
}
