import { timestamp, valued } from "./provenance.ts";
import type { Value } from "./provenance.ts";
export interface WaterRecord {
  timestamp: string;
  zone: string;
  storage_liters?: Value<number>;
  supply_liters?: Value<number>;
  consumption_liters?: Value<number>;
}
export interface ImportSummary {
  records: WaterRecord[];
  accepted: number;
  rejected: number;
  errors: string[];
  dateRange: [string, string] | null;
  zones: string[];
  missingFields: string[];
  reordered: boolean;
}
const columns = [
  "timestamp",
  "storage_liters",
  "supply_liters",
  "consumption_liters",
  "zone",
];
// RFC-style quoted cells, including embedded commas/newlines and escaped quotes.
function cells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new RangeError("Malformed CSV quoting.");
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        rows.push(row);
        row = [];
      }
    } else {
      if (closed && c.trim())
        throw new RangeError("Unexpected text after quoted cell.");
      cell += c;
    }
  }
  if (quoted) throw new RangeError("Unclosed CSV quote.");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}
export function parseCSV(
  text: string,
  source = "Local CSV import",
): ImportSummary {
  if (text.length > 500000)
    throw new RangeError("CSV limit is 500 KB; import at most 500 records.");
  const rows = cells(text.replace(/^\uFEFF/, "")),
    header = rows.shift()?.map((s) => s.trim());
  if (
    !header ||
    !header.includes("timestamp") ||
    header.some((c) => !columns.includes(c)) ||
    new Set(header).size !== header.length ||
    !header.some((c) => c.endsWith("_liters"))
  )
    throw new RangeError(
      "Use timestamp and at least one documented *_liters column. Unknown/duplicate columns are rejected.",
    );
  if (rows.length > 500) throw new RangeError("Import at most 500 records.");
  const records: WaterRecord[] = [],
    errors: string[] = [],
    seen = new Set<string>(),
    missing = new Set<string>();
  let reordered = false,
    previous = -Infinity;
  rows.forEach((row, index) => {
    try {
      if (row.length !== header.length)
        throw new RangeError("Column count mismatch");
      const r = Object.fromEntries(header.map((h, i) => [h, row[i].trim()]));
      if (
        !timestamp(r.timestamp) ||
        (new Date(r.timestamp).toISOString().slice(0, 10) !==
          r.timestamp.slice(0, 10) &&
          r.timestamp.endsWith("Z"))
      )
        throw new RangeError("Invalid timestamp; explicit timezone required");
      const time = new Date(r.timestamp).toISOString(),
        zone = r.zone || "site";
      if (zone.length > 80)
        throw new RangeError("Zone name exceeds 80 characters");
      const key = time + "|" + zone;
      if (seen.has(key)) throw new RangeError("Duplicate timestamp/zone");
      const record: WaterRecord = { timestamp: time, zone };
      let count = 0;
      for (const col of [
        "storage_liters",
        "supply_liters",
        "consumption_liters",
      ] as const) {
        if (!r[col]) {
          missing.add(col);
          continue;
        }
        if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(r[col]))
          throw new RangeError("Invalid nonnegative liters: " + col);
        const v = Number(r[col]);
        if (!Number.isFinite(v) || v > 1e9)
          throw new RangeError("Liters must be at most 1 billion");
        record[col] = valued(
          v,
          "IMPORTED_RECORD",
          source,
          time,
          "Daily interval total (except storage: instantaneous reading)",
        );
        count++;
      }
      if (!count) throw new RangeError("Missing all water values");
      if (Date.parse(time) < previous) reordered = true;
      previous = Date.parse(time);
      seen.add(key);
      records.push(record);
    } catch (e) {
      errors.push(
        "Row " +
          (index + 2) +
          ": " +
          (e instanceof Error ? e.message : "Invalid record"),
      );
    }
  });
  records.sort(
    (a, b) =>
      Date.parse(a.timestamp) - Date.parse(b.timestamp) ||
      a.zone.localeCompare(b.zone),
  );
  return {
    records,
    accepted: records.length,
    rejected: errors.length,
    errors,
    dateRange: records.length
      ? [records[0].timestamp, records.at(-1)!.timestamp]
      : null,
    zones: [...new Set(records.map((r) => r.zone))],
    missingFields: [...missing],
    reordered,
  };
}
export function median(values: number[]): number {
  if (!values.length) throw new RangeError("No values");
  const v = [...values].sort((a, b) => a - b),
    n = v.length;
  return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
}
export const historyPolicy = {
  minimum: 7,
  window: 28,
  maxGapHours: 26,
  minGapHours: 22,
} as const;
export function dailyHistory(records: WaterRecord[], zone: string, at: number) {
  const rows = records
    .filter(
      (r) =>
        r.zone === zone &&
        r.consumption_liters &&
        Date.parse(r.timestamp) <= at,
    )
    .slice(-historyPolicy.window - 1);
  // Consecutive daily intervals are required: no inference from sparse or sub-daily totals.
  let start = rows.length - 1;
  while (start > 0) {
    const h =
      (Date.parse(rows[start].timestamp) -
        Date.parse(rows[start - 1].timestamp)) /
      3600000;
    if (h < historyPolicy.minGapHours || h > historyPolicy.maxGapHours) break;
    start--;
  }
  return rows.slice(Math.max(0, start));
}
export function demandBaseline(
  records: WaterRecord[],
  at: number,
): Value<number> {
  const history = dailyHistory(records, "site", at).slice(
    -historyPolicy.window,
  );
  if (history.length < historyPolicy.minimum)
    throw new RangeError(
      "Derived site demand requires at least 7 consecutive daily site consumption records ending at the reading (within 26 hours).",
    );
  if (at - Date.parse(history.at(-1)!.timestamp) > 26 * 3600000)
    throw new RangeError(
      "Consumption history is not recent enough for this reading.",
    );
  return valued(
    median(history.map((r) => r.consumption_liters!.value)),
    "CALCULATED",
    "Imported site consumption",
    new Date(at).toISOString(),
    "Median of latest up to 28 consecutive daily site totals; minimum 7. Zones never automatically summed.",
  );
}
export function zoneAnomalies(records: WaterRecord[], at: number) {
  return [
    ...new Set(records.filter((r) => r.zone !== "site").map((r) => r.zone)),
  ].map((zone) => {
    const rows = dailyHistory(records, zone, at),
      latest = rows.at(-1),
      history = rows.slice(0, -1).slice(-historyPolicy.window);
    if (
      !latest ||
      history.length < historyPolicy.minimum ||
      at - Date.parse(latest.timestamp) > 26 * 3600000
    )
      return {
        zone,
        status: "INSUFFICIENT HISTORY" as const,
        reason:
          "Need 7 prior consecutive daily records and a recent latest reading.",
        count: history.length,
      };
    const expected = median(history.map((r) => r.consumption_liters!.value)),
      observed = latest.consumption_liters!.value,
      mad = median(
        history.map((r) => Math.abs(r.consumption_liters!.value - expected)),
      ),
      excess = observed - expected;
    const threshold = Math.max(3 * 1.4826 * mad, expected * 0.2, 1),
      flagged = excess > threshold;
    return {
      zone,
      status: flagged
        ? ("POTENTIAL ANOMALY" as const)
        : ("WITHIN BASELINE" as const),
      expected,
      observed,
      deviationPercent: expected ? (excess / expected) * 100 : null,
      excess: Math.max(0, excess),
      mad,
      threshold,
      count: history.length,
      validTime: latest.timestamp,
      reason: flagged
        ? "Excess exceeds max(3 × 1.4826 × MAD, 20% of median, 1 L). Inspection recommended; legitimate demand may explain it."
        : "Latest use is within the defined upper-deviation threshold.",
      quality:
        "Limited descriptive evidence; not a probability or confirmed leak",
    };
  });
}
