import { siteLocation } from "../../lib/location.ts";
import type { Category } from "../analysis/provenance.ts";
export type ValueKind =
  "observed" | "forecast" | "estimated" | "user-provided" | "demo";
export type Freshness = "fresh" | "aging" | "stale";
export interface SourceMetadata {
  name: string;
  url: string;
  license: string;
  resolution: string;
  update: string;
  kind: ValueKind;
  category: Category;
}
export const environmentalLocation = Object.freeze({
  name: siteLocation.regionName,
  latitude: siteLocation.latitude,
  longitude: siteLocation.longitude,
});
export const source = Object.freeze({
  name: "Open-Meteo / DWD ICON Global",
  url: "https://open-meteo.com/en/docs/dwd-api",
  license: "CC BY 4.0",
  resolution: "~11 km model grid · Hourly output",
  update: "Model updates approximately every 6 hours",
  kind: "estimated" as ValueKind,
  category: "LIVE_API" as Category,
});
export interface Indicator {
  value: number;
  unit: "mm";
  kind: ValueKind;
  category: Category;
  start: string;
  end: string;
}
export interface EnvironmentalSnapshot {
  source: SourceMetadata;
  location: typeof environmentalLocation;
  grid: { latitude: number; longitude: number };
  fetchedAt: string;
  latestAvailableEstimate: string;
  observationTimestamp: null;
  modelRunTimestamp: null;
  recentRain: Indicator;
  forecastPrecipitation: Indicator;
}
export interface EnvironmentalResult {
  status: "available" | "cached" | "unavailable" | "demo";
  freshness: Freshness | null;
  snapshot: EnvironmentalSnapshot | null;
  attemptedAt: string;
  issue:
    | "timeout"
    | "rate-limit"
    | "invalid-data"
    | "unavailable"
    | "offline-demo"
    | null;
}
const HOUR = 3600000;
export function classifyFreshness(
  snapshot: EnvironmentalSnapshot,
  now: number,
): Freshness {
  const age = Math.max(
    now - Date.parse(snapshot.fetchedAt),
    now - Date.parse(snapshot.latestAvailableEstimate),
  );
  return age <= 6 * HOUR ? "fresh" : age <= 24 * HOUR ? "aging" : "stale";
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid object");
  return value as Record<string, unknown>;
}
export function normalizeOpenMeteo(
  raw: unknown,
  now: number,
): EnvironmentalSnapshot {
  const data = record(raw),
    hourly = record(data.hourly),
    units = record(data.hourly_units);
  if (
    units.time !== "unixtime" ||
    units.rain !== "mm" ||
    units.showers !== "mm" ||
    units.precipitation !== "mm" ||
    data.utc_offset_seconds !== 0
  )
    throw new Error("Invalid units/timezone");
  const times = hourly.time,
    rain = hourly.rain,
    showers = hourly.showers,
    precipitation = hourly.precipitation;
  if (
    !Array.isArray(times) ||
    !Array.isArray(rain) ||
    !Array.isArray(showers) ||
    !Array.isArray(precipitation) ||
    times.length !== rain.length ||
    times.length !== showers.length ||
    times.length !== precipitation.length ||
    !times.length ||
    times.length > 240
  )
    throw new Error("Missing hourly fields");
  for (let i = 0; i < times.length; i++) {
    if (
      !Number.isInteger(times[i]) ||
      (i > 0 && times[i] - times[i - 1] !== 3600) ||
      !Number.isFinite(rain[i]) ||
      !Number.isFinite(showers[i]) ||
      !Number.isFinite(precipitation[i]) ||
      rain[i] < 0 ||
      showers[i] < 0 ||
      precipitation[i] < 0
    )
      throw new Error("Invalid hourly value");
  }
  const lat = data.latitude,
    lon = data.longitude;
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat - environmentalLocation.latitude) > 1 ||
    Math.abs(lon - environmentalLocation.longitude) > 1
  )
    throw new Error("Invalid grid location");
  const boundary = Math.floor(now / HOUR) * 3600;
  const endIndex = times.indexOf(boundary);
  if (endIndex < 23 || endIndex + 24 >= times.length)
    throw new Error("Incomplete 24-hour windows");
  const iso = (seconds: number) => new Date(seconds * 1000).toISOString();
  // Open-Meteo precipitation values cover the preceding hour. Endpoints are exclusive at the start.
  return {
    source,
    location: environmentalLocation,
    grid: { latitude: lat, longitude: lon },
    fetchedAt: new Date(now).toISOString(),
    latestAvailableEstimate: iso(boundary),
    observationTimestamp: null,
    modelRunTimestamp: null,
    recentRain: {
      value: rain
        .slice(endIndex - 23, endIndex + 1)
        .reduce(
          (a: number, b: number, i: number) =>
            a + b + showers[endIndex - 23 + i],
          0,
        ),
      unit: "mm",
      kind: "estimated",
      category: "LIVE_API",
      start: iso(boundary - 86400),
      end: iso(boundary),
    },
    forecastPrecipitation: {
      value: precipitation
        .slice(endIndex + 1, endIndex + 25)
        .reduce((a: number, b: number) => a + b, 0),
      unit: "mm",
      kind: "forecast",
      category: "LIVE_API",
      start: iso(boundary),
      end: iso(boundary + 86400),
    },
  };
}
export function demoEnvironment(now: number): EnvironmentalResult {
  const end = Date.parse("2026-10-07T08:00:00Z"),
    iso = (ms: number) => new Date(ms).toISOString();
  return {
    status: "demo",
    freshness: null,
    attemptedAt: iso(now),
    issue: "offline-demo",
    snapshot: {
      source: {
        ...source,
        name: "JalDrishti illustrative fixture",
        url: "",
        kind: "demo",
        category: "DEMO_SYNTHETIC",
        resolution: "Illustrative regional example · No observation grid",
        update: "Fixed fixture · No public model updates",
        license: "Project demo fixture",
      },
      location: environmentalLocation,
      grid: environmentalLocation,
      fetchedAt: iso(end),
      latestAvailableEstimate: iso(end),
      observationTimestamp: null,
      modelRunTimestamp: null,
      recentRain: {
        value: 4.2,
        unit: "mm",
        kind: "demo",
        category: "DEMO_SYNTHETIC",
        start: iso(end - 86400000),
        end: iso(end),
      },
      forecastPrecipitation: {
        value: 7.8,
        unit: "mm",
        kind: "demo",
        category: "DEMO_SYNTHETIC",
        start: iso(end),
        end: iso(end + 86400000),
      },
    },
  };
}
