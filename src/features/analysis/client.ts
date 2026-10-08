import { ApiError } from "../../lib/api-client.ts";
import { jsonBody } from "../../lib/body-hash.ts";
import { parseAnalysisCampus } from "./contract.ts";
import type { AnalysisCampus } from "./contract.ts";
import { realForecastInput, runAnalysis } from "./model.ts";
import type { RealAnalysis } from "./model.ts";
import { forecastStorage } from "../forecast/model.ts";
import { assertNoDemo, parseLocation, timestamp } from "./provenance.ts";
import type { AnalysisLocation } from "./provenance.ts";
import type { EnvironmentBundle } from "./environment.ts";
import type { ImportSummary, WaterRecord } from "./records.ts";
const messages: Record<string, string> = {
  UNAUTHORIZED: "Unlock private cloud access to load or save Real Analysis.",
  FORBIDDEN: "This frontend origin is not approved for private cloud access.",
  NOT_FOUND: "No saved Real Analysis yet. No Sample Demo data is substituted.",
  CONFLICT: "The saved analysis changed. Reload cloud state before saving again.",
  INVALID_INPUT: "Cloud rejected the analysis, provenance or payload size.",
  RATE_LIMIT: "Cloud is rate limited. Wait before retrying.",
  BACKEND_UNAVAILABLE: "Backend unavailable. Your local analysis remains usable.",
};
function equivalent(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-8;
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => equivalent(v, b[i]));
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => k in y && equivalent(x[k], y[k]));
}
export function parseAnalysisEnvelope(raw: unknown): AnalysisCampus {
  const r = raw as { execution: string; campus: unknown };
  if (r?.execution !== "aws-lambda") throw new RangeError("Not an AWS analysis response.");
  return parseAnalysisCampus(r.campus);
}
export function parseRegionalEnvelope(raw: unknown, location: AnalysisLocation): EnvironmentBundle {
  const r = raw as { execution: string; environment: EnvironmentBundle };
  const e = r?.environment;
  if (r?.execution !== "aws-lambda" || !e || !timestamp(e.attemptedAt) || JSON.stringify(parseLocation(e.location)) !== JSON.stringify(parseLocation(location))) throw new RangeError("Invalid regional boundary or location.");
  assertNoDemo(e);
  for (const segment of [e.weather, e.history]) {
    if (!segment || !["available", "cached", "unavailable"].includes(segment.status)) throw new RangeError("Invalid regional status.");
    if (segment.status === "unavailable") {
      if (segment.data !== null) throw new RangeError("Unavailable data cannot substitute values.");
    } else if (!segment.data || !timestamp(segment.data.retrievedAt) || !timestamp(segment.data.validTime) || !segment.data.source || !segment.data.model || !Number.isFinite(segment.data.grid?.latitude) || !Number.isFinite(segment.data.grid?.longitude) || JSON.stringify(parseLocation(segment.data.requested)) !== JSON.stringify(parseLocation(location))) throw new RangeError("Invalid regional provenance.");
  }
  const w = e.weather.data;
  if (w) {
    if (!Array.isArray(w.indicators) || w.indicators.length !== 7) throw new RangeError("Missing regional indicators.");
    for (const i of [...w.indicators, w.forecastPrecipitation]) {
      if (!i || !["available", "unavailable"].includes(i.status)) throw new RangeError("Invalid indicator.");
      if (i.status === "unavailable") { if (i.value !== null) throw new RangeError("Invalid unavailable value."); }
      else if (!i.value || !Number.isFinite(i.value.value) || i.value.value < 0 || !i.unit || !timestamp(i.validTime) || !timestamp(i.value.provenance.timestamp) || !i.value.provenance.source || !["LIVE_API", "MODEL_OUTPUT"].includes(i.value.provenance.category)) throw new RangeError("Invalid indicator provenance.");
    }
  }
  const h = e.history.data;
  if (h) for (const v of [h.recentPrecipitation, h.historicalMean, h.ratio, h.recentTemperature, h.historicalTemperature]) {
    if (v !== null && (!v || !Number.isFinite(v.value) || !timestamp(v.provenance.timestamp) || !v.provenance.source || !["PUBLIC_DATASET", "CALCULATED"].includes(v.provenance.category))) throw new RangeError("Invalid historical provenance.");
  }
  return e;
}
export function parseRealForecast(raw: unknown, campus: AnalysisCampus) {
  const r = raw as { campusId: string; campusVersion: number; execution: string; executedAt: string; input: unknown; baseline: unknown; analysis: ReturnType<typeof runAnalysis> };
  if (!r || r.execution !== "aws-lambda" || r.campusId !== "real-site" || r.campusVersion !== campus.version || !timestamp(r.executedAt)) throw new RangeError("Invalid forecast revision.");
  const input = realForecastInput(campus.analysis);
  if (!equivalent(r.input, input) || !equivalent(r.baseline, forecastStorage(input))) throw new RangeError("AWS forecast differs from the approved engine.");
  assertNoDemo(r.analysis);
  // All operational outputs must reproduce locally. Rainfall is the only optional contextual component.
  const rainfall = r.analysis?.index?.components?.find(c => c.key === "rainfall");
  const context = rainfall?.score == null ? {} : {
    rainfallRatio: rainfall.score / 100,
    rainfallProvenance: { category: "CALCULATED" as const, source: "Validated AWS contextual index", timestamp: r.executedAt },
  };
  const expected = runAnalysis(campus.analysis, context);
  if (!equivalent(r.analysis, expected)) throw new RangeError("Invalid analysis calculation.");
  return expected;
}
export function recordsSummary(records: WaterRecord[]): ImportSummary {
  return {
    records, accepted: records.length, rejected: 0, errors: [], reordered: false,
    dateRange: records.length ? [records[0].timestamp, records[records.length - 1].timestamp] : null,
    zones: [...new Set(records.map(r => r.zone))],
    missingFields: ["storage_liters", "supply_liters", "consumption_liters"].filter(k => records.some(r => !(k in r))),
  };
}
export function createRealClient(options: { fetcher?: typeof fetch; timeoutMs?: number } = {}) {
  async function request(operation: string, method = "GET", payload?: unknown): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const response = await (options.fetcher ?? fetch)(`/api/real-analysis/${operation}`, {
            method, credentials: "same-origin", cache: "no-store", signal: controller.signal,
            ...(payload === undefined ? {} : await jsonBody(payload)),
          });
          const raw = await response.json();
          if (!response.ok) {
            const code = raw?.error?.code in messages ? raw.error.code : "BACKEND_UNAVAILABLE";
            throw new ApiError(code, response.status, messages[code]);
          }
          return raw;
        })(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new ApiError("TIMEOUT", 0, "Request timed out. Reload cloud state before retrying a save; local edits remain available.")); }, options.timeoutMs ?? 25000); }),
      ]);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError("BACKEND_UNAVAILABLE", 0, messages.BACKEND_UNAVAILABLE);
    } finally { if (timer) clearTimeout(timer); }
  }
  async function checked<T>(work: Promise<unknown>, parse: (raw: unknown) => T): Promise<T> {
    try { return parse(await work); }
    catch (e) { if (e instanceof ApiError) throw e; throw new ApiError("INVALID_RESPONSE", 0, "Invalid cloud data. Local inputs are retained."); }
  }
  return {
    async session() {
      const r = await request("session") as { configured: boolean; authenticated: boolean };
      if (typeof r.configured !== "boolean" || typeof r.authenticated !== "boolean") throw new ApiError("INVALID_RESPONSE", 0, "Invalid private session.");
      return r;
    },
    unlock: (accessCode: string) => request("session", "POST", { accessCode }),
    lock: () => request("session", "POST", { action: "logout" }),
    load: () => checked(request("campus"), parseAnalysisEnvelope),
    save(analysis: RealAnalysis, expectedVersion: number) {
      realForecastInput(analysis);
      return checked(request("campus", "PUT", { analysis, expectedVersion }), parseAnalysisEnvelope);
    },
    environment: (campus: AnalysisCampus) => checked(request("environment"), raw => parseRegionalEnvelope(raw, campus.analysis.location.value)),
    forecast: (campus: AnalysisCampus) => checked(request("forecast", "POST", { campusId: "real-site", expectedVersion: campus.version, horizonDays: 30 }), raw => parseRealForecast(raw, campus)),
  };
}
export const realClient = createRealClient();
