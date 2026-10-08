import { parseLocation, valued } from "./provenance.ts";
import type { AnalysisLocation, Value } from "./provenance.ts";
export const weatherFields = {
  precipitation: "mm",
  rain: "mm",
  runoff: "mm",
  et0_fao_evapotranspiration: "mm",
  soil_moisture_0_to_7cm: "m³/m³",
  soil_moisture_7_to_28cm: "m³/m³",
  soil_moisture_28_to_100cm: "m³/m³",
} as const;
export type WeatherField = keyof typeof weatherFields;
export interface Indicator {
  name: WeatherField;
  unit: string;
  value: Value<number> | null;
  validTime: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  status: "available" | "unavailable";
  reason: string;
}
export interface RegionalWeather {
  label: "REGIONAL MODEL DATA";
  source: string;
  model: string;
  requested: AnalysisLocation;
  grid: { latitude: number; longitude: number };
  spatialContext: string;
  retrievedAt: string;
  validTime: string;
  freshness: "fresh" | "stale";
  indicators: Indicator[];
  forecastPrecipitation: Indicator;
  potentialEvapotranspiration: { status: "unavailable"; reason: string };
  endpoint: string;
}
export interface HistoricalContext {
  source: string;
  model: string;
  requested: AnalysisLocation;
  grid: { latitude: number; longitude: number };
  spatialContext: string;
  retrievedAt: string;
  validTime: string;
  window: [string, string];
  historicalWindows: [string, string][];
  recentPrecipitation: Value<number>;
  historicalMean: Value<number>;
  ratio: Value<number> | null;
  recentTemperature: Value<number>;
  historicalTemperature: Value<number>;
  description: string;
  endpoint: string;
}
export interface EnvironmentBundle {
  location: AnalysisLocation;
  attemptedAt: string;
  weather: {
    status: "available" | "cached" | "unavailable";
    data: RegionalWeather | null;
    issue: string | null;
  };
  history: {
    status: "available" | "cached" | "unavailable";
    data: HistoricalContext | null;
    issue: string | null;
  };
}
const obj = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new RangeError("Invalid API object");
  return v as Record<string, unknown>;
};
const numeric = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
export function weatherURL(location: AnalysisLocation) {
  const l = parseLocation(location);
  return (
    "https://api.open-meteo.com/v1/ecmwf?" +
    new URLSearchParams({
      latitude: String(l.latitude),
      longitude: String(l.longitude),
      models: "ecmwf_ifs025",
      hourly: Object.keys(weatherFields).join(","),
      past_days: "7",
      forecast_days: "3",
      timezone: "GMT",
      timeformat: "unixtime",
    })
  );
}
function grid(raw: Record<string, unknown>, l: AnalysisLocation) {
  if (
    !numeric(raw.latitude, -90, 90) ||
    !numeric(raw.longitude, -180, 180) ||
    Math.abs(raw.latitude - l.latitude) > 1 ||
    Math.min(
      Math.abs(raw.longitude - l.longitude),
      360 - Math.abs(raw.longitude - l.longitude),
    ) > 1
  )
    throw new RangeError("Response grid does not match requested region");
  return { latitude: raw.latitude, longitude: raw.longitude };
}
export function normalizeWeather(
  rawValue: unknown,
  location: AnalysisLocation,
  now: number,
): RegionalWeather {
  const l = parseLocation(location),
    raw = obj(rawValue),
    hourly = obj(raw.hourly),
    units = obj(raw.hourly_units),
    times = hourly.time;
  if (
    !Array.isArray(times) ||
    times.length < 2 ||
    times.length > 1000 ||
    times.some(
      (t, i) => !numeric(t, 0, 1e11) || (i > 0 && t - times[i - 1] !== 3600),
    )
  )
    throw new RangeError("Invalid or unordered hourly timestamps");
  const timeList = times as number[];
  const available = times
      .map((t, i) => ({ t: t as number, i }))
      .filter((p) => p.t * 1000 <= now),
    last = available.at(-1);
  if (!last || now - last.t * 1000 > 86400000)
    throw new RangeError("No recent valid model time");
  const retrievedAt = new Date(now).toISOString(),
    validTime = new Date(last.t * 1000).toISOString();
  function indicator(name: WeatherField, forecast = false): Indicator {
    const soil = name.startsWith("soil_"),
      selected = soil
        ? [last!]
        : timeList
            .map((t, i) => ({ t, i }))
            .filter((p) =>
              forecast
                ? p.t * 1000 > now && p.t * 1000 <= now + 72 * 3600000
                : p.t * 1000 > last!.t * 1000 - 7 * 86400000 &&
                  p.t * 1000 <= last!.t * 1000,
            );
    const data = hourly[name],
      reason = soil
        ? "Latest volumetric soil water fraction"
        : "Hourly sums over the explicit window; regional model estimate";
    const base = {
      name,
      unit: weatherFields[name],
      validTime,
      windowStart: selected.length
        ? new Date((selected[0].t - (soil ? 0 : 3600)) * 1000).toISOString()
        : null,
      windowEnd: selected.length
        ? new Date(selected.at(-1)!.t * 1000).toISOString()
        : null,
      reason,
    };
    if (
      !Array.isArray(data) ||
      data.length !== timeList.length ||
      units[name] !== weatherFields[name] ||
      !selected.length ||
      (!soil && !forecast && selected.length !== 168) ||
      (!soil && forecast && selected.length < 48) ||
      selected.some((p) => !numeric(data[p.i], 0, soil ? 1 : 1000))
    )
      return {
        ...base,
        value: null,
        status: "unavailable",
        reason:
          "Missing, unsupported, invalid units or incomplete time window. No substitute used.",
      };
    return {
      ...base,
      status: "available",
      value: valued(
        selected.reduce((s, p) => s + (data[p.i] as number), 0),
        "LIVE_API",
        "Open-Meteo / ECMWF IFS 0.25°",
        validTime,
        reason,
      ),
    };
  }
  return {
    label: "REGIONAL MODEL DATA",
    source: "Open-Meteo",
    model: "ECMWF IFS 0.25°",
    requested: l,
    grid: grid(raw, l),
    spatialContext:
      "Global 0.25° (~25 km) grid; hourly API values interpolate native 3/6-hour output. Grid conditions are not campus sensors.",
    retrievedAt,
    validTime,
    freshness: now - last.t * 1000 <= 6 * 3600000 ? "fresh" : "stale",
    indicators: (Object.keys(weatherFields) as WeatherField[]).map((n) =>
      indicator(n),
    ),
    forecastPrecipitation: indicator("precipitation", true),
    potentialEvapotranspiration: {
      status: "unavailable",
      reason:
        "No separate potential-evapotranspiration variable in this selected endpoint. ET0 is reported separately, not relabeled as actual or potential ET.",
    },
    endpoint: weatherURL(l),
  };
}
function day(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}
export function historicalWindows(now: number): [string, string][] {
  const end = now - 7 * 86400000,
    start = end - 6 * 86400000;
  const windows: [string, string][] = [[day(start), day(end)]];
  for (let year = 1; year <= 3; year++) {
    const a = new Date(start),
      b = new Date(end);
    a.setUTCFullYear(a.getUTCFullYear() - year);
    b.setUTCFullYear(b.getUTCFullYear() - year);
    windows.push([day(a.getTime()), day(b.getTime())]);
  }
  return windows;
}
export function archiveURL(l: AnalysisLocation, window: [string, string]) {
  parseLocation(l);
  return (
    "https://archive-api.open-meteo.com/v1/archive?" +
    new URLSearchParams({
      latitude: String(l.latitude),
      longitude: String(l.longitude),
      start_date: window[0],
      end_date: window[1],
      models: "era5",
      daily: "precipitation_sum,temperature_2m_mean",
      timezone: "GMT",
    })
  );
}
export function normalizeHistory(
  payloads: unknown[],
  location: AnalysisLocation,
  now: number,
): HistoricalContext {
  const windows = historicalWindows(now);
  if (payloads.length !== 4)
    throw new RangeError("Need recent window and all 3 historical windows");
  const points = payloads.map((p, index) => {
    const raw = obj(p),
      d = obj(raw.daily),
      u = obj(raw.daily_units),
      dates = d.time,
      precip = d.precipitation_sum,
      temp = d.temperature_2m_mean;
    grid(raw, location);
    if (
      !Array.isArray(dates) ||
      dates.length !== 7 ||
      dates[0] !== windows[index][0] ||
      dates.at(-1) !== windows[index][1] ||
      dates.some(
        (v, i) => v !== day(Date.parse(windows[index][0]) + i * 86400000),
      ) ||
      !Array.isArray(precip) ||
      !Array.isArray(temp) ||
      precip.length !== 7 ||
      temp.length !== 7 ||
      precip.some((v) => !numeric(v, 0, 1000)) ||
      temp.some((v) => !numeric(v, -90, 65)) ||
      u.precipitation_sum !== "mm" ||
      u.temperature_2m_mean !== "°C"
    )
      throw new RangeError("Incomplete or invalid historical daily window");
    return {
      rain: precip.reduce((s: number, v: number) => s + v, 0) as number,
      temp: temp.reduce((s: number, v: number) => s + v, 0) / 7,
      grid: grid(raw, location),
    };
  });
  const time = windows[0][1] + "T23:59:59.000Z",
    retrievedAt = new Date(now).toISOString(),
    mean = points.slice(1).reduce((s, p) => s + p.rain, 0) / 3;
  return {
    source: "Open-Meteo archive / Copernicus",
    model: "ERA5 reanalysis",
    requested: parseLocation(location),
    grid: points[0].grid,
    spatialContext:
      "Global 0.25° (~25 km), daily aggregation; retrospective reanalysis, not live station measurements",
    retrievedAt,
    validTime: time,
    window: windows[0],
    historicalWindows: windows.slice(1),
    recentPrecipitation: valued(
      points[0].rain,
      "PUBLIC_DATASET",
      "ERA5 reanalysis",
      time,
      "7-day total ending 7 days before retrieval",
    ),
    historicalMean: valued(
      mean,
      "CALCULATED",
      "ERA5 reanalysis",
      time,
      "Mean of matching 7-day totals in prior 3 years; short comparison, not climatological normal",
    ),
    ratio:
      mean > 0
        ? valued(
            points[0].rain / mean,
            "CALCULATED",
            "ERA5 same-season comparison",
            time,
            "Recent 7-day total / prior 3-year same-window mean",
          )
        : null,
    recentTemperature: valued(
      points[0].temp,
      "PUBLIC_DATASET",
      "ERA5 reanalysis",
      time,
      "Recent-window mean °C",
    ),
    historicalTemperature: valued(
      points.slice(1).reduce((s, p) => s + p.temp, 0) / 3,
      "CALCULATED",
      "ERA5 reanalysis",
      time,
      "Mean of three matching historical-window temperatures °C",
    ),
    description:
      "Delayed regional reanalysis comparison. Only 3 prior years: not a 30-year climatology. Cross-model comparisons with ECMWF are avoided.",
    endpoint: archiveURL(location, windows[0]),
  };
}
export function createRegionalProvider(
  options: {
    fetcher?: typeof fetch;
    now?: () => number;
    timeoutMs?: number;
  } = {},
) {
  const fetcher = options.fetcher ?? fetch,
    clock = options.now ?? Date.now,
    cache = new Map<string, { time: number; bundle: EnvironmentBundle }>(),
    pending = new Map<string, Promise<EnvironmentBundle>>();
  async function json(url: string) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const r = await fetcher(url, {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!r.ok)
            throw new Error(
              r.status === 429 ? "Rate limited" : "Temporarily unavailable",
            );
          return r.json();
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("Timeout"));
          }, options.timeoutMs ?? 8000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async function load(location: AnalysisLocation): Promise<EnvironmentBundle> {
    const l = parseLocation(location),
      key = JSON.stringify(l),
      now = clock(),
      last = cache.get(key);
    if (last && now - last.time < 900000) return structuredClone(last.bundle);
    if (pending.has(key)) return pending.get(key)!;
    const work = (async () => {
      const [weather, history] = await Promise.allSettled([
        json(weatherURL(l)).then((p) => normalizeWeather(p, l, clock())),
        Promise.all(
          historicalWindows(now).map((w) => json(archiveURL(l, w))),
        ).then((p) => normalizeHistory(p, l, clock())),
      ]);
      const bundle: EnvironmentBundle = {
        location: l,
        attemptedAt: new Date(clock()).toISOString(),
        weather:
          weather.status === "fulfilled"
            ? { status: "available", data: weather.value, issue: null }
            : {
                status: last?.bundle.weather.data ? "cached" : "unavailable",
                data: last?.bundle.weather.data
                  ? { ...last.bundle.weather.data, freshness: "stale" }
                  : null,
                issue:
                  weather.reason instanceof Error
                    ? weather.reason.message
                    : "Unavailable",
              },
        history:
          history.status === "fulfilled"
            ? { status: "available", data: history.value, issue: null }
            : {
                status: last?.bundle.history.data ? "cached" : "unavailable",
                data: last?.bundle.history.data ?? null,
                issue:
                  history.reason instanceof Error
                    ? history.reason.message
                    : "Unavailable",
              },
      };
      if (cache.size >= 20) cache.delete(cache.keys().next().value!);
      cache.set(key, { time: clock(), bundle });
      return structuredClone(bundle);
    })();
    pending.set(key, work);
    try {
      return await work;
    } finally {
      pending.delete(key);
    }
  }
  return { load };
}
