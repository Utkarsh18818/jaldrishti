export const categories = [
  "LIVE_API",
  "PUBLIC_DATASET",
  "USER_PROVIDED",
  "IMPORTED_RECORD",
  "CALCULATED",
  "MODEL_OUTPUT",
  "DEMO_SYNTHETIC",
] as const;
export type Category = (typeof categories)[number];
export interface Provenance {
  category: Category;
  source: string;
  timestamp: string;
  method?: string;
}
export interface Value<T> {
  value: T;
  provenance: Provenance;
}
export function timestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  const date = value.slice(0, 10);
  return new Date(date + "T00:00:00Z").toISOString().slice(0, 10) === date;
}
export function valued<T>(
  value: T,
  category: Category,
  source: string,
  time: string,
  method?: string,
): Value<T> {
  if (!timestamp(time))
    throw new RangeError("An ISO timestamp with timezone is required.");
  return {
    value,
    provenance: {
      category,
      source,
      timestamp: time,
      ...(method ? { method } : {}),
    },
  };
}
export function assertNoDemo(value: unknown): void {
  if (value === "DEMO_SYNTHETIC" || value === "seeded")
    throw new RangeError("Synthetic inputs cannot enter Real Analysis.");
  if (Array.isArray(value)) value.forEach(assertNoDemo);
  else if (value && typeof value === "object")
    Object.values(value).forEach(assertNoDemo);
}
export interface AnalysisLocation {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}
export function parseLocation(raw: unknown): AnalysisLocation {
  const l = raw as AnalysisLocation;
  if (
    !l ||
    typeof l.name !== "string" ||
    !l.name.trim() ||
    l.name.length > 100 ||
    !Number.isFinite(l.latitude) ||
    Math.abs(l.latitude) > 90 ||
    !Number.isFinite(l.longitude) ||
    Math.abs(l.longitude) > 180 ||
    typeof l.timezone !== "string"
  )
    throw new RangeError(
      "Provide location name, valid latitude/longitude and timezone.",
    );
  try {
    new Intl.DateTimeFormat("en", { timeZone: l.timezone }).format();
  } catch {
    throw new RangeError("Use a valid IANA timezone.");
  }
  return {
    name: l.name.trim(),
    latitude: l.latitude,
    longitude: l.longitude,
    timezone: l.timezone,
  };
}
