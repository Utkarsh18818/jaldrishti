import { parseLocation, timestamp, valued } from "./provenance.ts";
import type { AnalysisLocation, Value } from "./provenance.ts";
export interface GroundwaterContext {
  label: "REGIONAL GROUNDWATER CONTEXT";
  region: string;
  location: AnalysisLocation;
  depthBelowGroundMetres: Value<number>;
  sourceURL: string;
  limitations: string;
}
export interface GroundwaterProvider {
  load(location: AnalysisLocation): Promise<GroundwaterContext | null>;
}
export function importGroundwater(raw: unknown): GroundwaterContext {
  const r = raw as {
    region: string;
    location: AnalysisLocation;
    depthBelowGroundMetres: number;
    validTime: string;
    sourceURL: string;
  };
  if (
    !r ||
    typeof r.region !== "string" ||
    !r.region.trim() ||
    r.region.length > 100 ||
    !Number.isFinite(r.depthBelowGroundMetres) ||
    r.depthBelowGroundMetres < 0 ||
    r.depthBelowGroundMetres > 1000 ||
    !timestamp(r.validTime)
  )
    throw new RangeError(
      "Groundwater requires region, location, depth in metres, valid timestamp and authoritative source URL.",
    );
  const url = new URL(r.sourceURL);
  if (
    url.protocol !== "https:" ||
    !["cgwb.gov.in", "gwdata.cgwb.gov.in", "indiawris.gov.in"].some(
      (h) => url.hostname === h || url.hostname.endsWith("." + h),
    )
  )
    throw new RangeError("Use an HTTPS CGWB or India-WRIS dataset URL.");
  return {
    label: "REGIONAL GROUNDWATER CONTEXT",
    region: r.region.trim(),
    location: parseLocation(r.location),
    depthBelowGroundMetres: valued(
      r.depthBelowGroundMetres,
      "IMPORTED_RECORD",
      url.toString(),
      r.validTime,
      "User transcription/import of authoritative regional record; not independently verified",
    ),
    sourceURL: url.toString(),
    limitations:
      "Regional source record, not campus groundwater. A single value cannot establish trend or aquifer stress; excluded from index without local baseline.",
  };
}
