import { realForecastInput, indexPolicy } from "./model.ts";
import type { RealAnalysis } from "./model.ts";
import type { Provenance } from "./provenance.ts";
import { timestamp } from "./provenance.ts";
import { assertNoDemo, categories } from "./provenance.ts";
import type { EnvironmentBundle } from "./environment.ts";
export interface EnvironmentalProvenance extends Provenance {
  variable: string;
  model: string;
  coordinates: { latitude: number; longitude: number };
  retrievedAt: string;
  unit: string;
  context: string;
}
export const realCampusId = "real-site";
export interface AnalysisCampus {
  schemaVersion: 2;
  campusId: typeof realCampusId;
  analysisMode: "REAL_ANALYSIS";
  analysis: RealAnalysis;
  version: number;
  updatedAt: string;
  modelMetadata: {
    forecast: "deterministic-storage-v1";
    indexVersion: typeof indexPolicy.version;
  };
  environmentalProvenance: EnvironmentalProvenance[];
}
export function createAnalysisCampus(
  analysis: RealAnalysis,
  version: number,
  now: number,
): AnalysisCampus {
  realForecastInput(analysis);
  if (!Number.isSafeInteger(version) || version < 1)
    throw new RangeError("Invalid campus version");
  return {
    schemaVersion: 2,
    campusId: realCampusId,
    analysisMode: "REAL_ANALYSIS",
    analysis: structuredClone(analysis),
    version,
    updatedAt: new Date(now).toISOString(),
    modelMetadata: {
      forecast: "deterministic-storage-v1",
      indexVersion: indexPolicy.version,
    },
    environmentalProvenance: [],
  };
}
export function parseAnalysisCampus(raw: unknown): AnalysisCampus {
  const r = raw as AnalysisCampus;
  if (
    !r ||
    r.schemaVersion !== 2 ||
    r.campusId !== realCampusId ||
    r.analysisMode !== "REAL_ANALYSIS" ||
    !timestamp(r.updatedAt) ||
    r.modelMetadata?.forecast !== "deterministic-storage-v1" ||
    r.modelMetadata?.indexVersion !== indexPolicy.version
  )
    throw new RangeError("Invalid Real Analysis campus record.");
  const campus = createAnalysisCampus(
    r.analysis,
    r.version,
    Date.parse(r.updatedAt),
  );
  if (
    !Array.isArray(r.environmentalProvenance) ||
    r.environmentalProvenance.length > 20
  )
    throw new RangeError("Invalid environmental provenance.");
  assertNoDemo(r.environmentalProvenance);
  for (const p of r.environmentalProvenance)
    if (
      !p ||
      !categories.includes(p.category) ||
      !timestamp(p.timestamp) ||
      !timestamp(p.retrievedAt) ||
      !p.source ||
      !p.variable ||
      !p.model ||
      !Number.isFinite(p.coordinates?.latitude) ||
      !Number.isFinite(p.coordinates?.longitude)
    )
      throw new RangeError("Invalid source metadata.");
  campus.environmentalProvenance = structuredClone(r.environmentalProvenance);
  return campus;
}
export function environmentProvenance(
  bundle: EnvironmentBundle,
): EnvironmentalProvenance[] {
  const entries: EnvironmentalProvenance[] = [];
  if (bundle.weather.status === "available" && bundle.weather.data) {
    const w = bundle.weather.data;
    for (const i of [...w.indicators, w.forecastPrecipitation])
      if (i.value)
        entries.push({
          ...i.value.provenance,
          variable:
            i === w.forecastPrecipitation ? "forecast_precipitation" : i.name,
          model: w.model,
          coordinates: w.grid,
          retrievedAt: w.retrievedAt,
          unit: i.unit,
          context: w.spatialContext,
        });
  }
  if (bundle.history.status === "available" && bundle.history.data) {
    const h = bundle.history.data;
    for (const [variable, v, unit] of [
      ["recent_precipitation", h.recentPrecipitation, "mm"],
      ["historical_mean", h.historicalMean, "mm"],
      ["rainfall_ratio", h.ratio, "ratio"],
    ] as const)
      if (v)
        entries.push({
          ...v.provenance,
          variable,
          model: h.model,
          coordinates: h.grid,
          retrievedAt: h.retrievedAt,
          unit,
          context: h.description,
        });
  }
  return entries;
}
