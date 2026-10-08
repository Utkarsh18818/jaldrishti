import {
  campusId,
  parseCampus,
  object,
  isExecution,
  validTimestamp,
} from "./backend-contract.ts";
import type {
  CampusEnvelope,
  ForecastEnvelope,
  Execution,
} from "./backend-contract.ts";
import type { OperationalValues } from "../features/system/model.ts";
import type { ForecastResult } from "../features/forecast/model.ts";
import { validateInput } from "../features/forecast/model.ts";
import { jsonBody } from "./body-hash.ts";
import type { EnvironmentalResult } from "../features/environment/model.ts";
export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const errorMessages: Record<string, string> = {
  NOT_FOUND: "Campus is not yet saved in this backend.",
  CONFLICT: "Campus changed. Reload backend state before saving again.",
  INVALID_INPUT: "Backend rejected the operational inputs.",
  BACKEND_UNAVAILABLE: "Backend unavailable. Local demo remains usable.",
};
export function parseCampusEnvelope(raw: unknown): CampusEnvelope {
  const value = object(raw);
  if (!isExecution(value.execution))
    throw new Error("Invalid execution metadata.");
  return { campus: parseCampus(value.campus), execution: value.execution };
}
function forecastResult(
  raw: unknown,
  horizon: number,
  capacity: number,
  startTime: number,
): ForecastResult {
  const r = object(raw);
  if (
    r.horizonDays !== horizon ||
    !Array.isArray(r.points) ||
    r.points.length !== horizon + 1 ||
    !Array.isArray(r.assumptions) ||
    !r.assumptions.every((a) => typeof a === "string") ||
    !Number.isFinite(r.netDailyDeficitLitres) ||
    !Number.isFinite(r.minimumStorageLitres)
  )
    throw new Error("Invalid forecast result.");
  for (let i = 0; i < r.points.length; i++) {
    const p = object(r.points[i]);
    if (
      p.day !== i ||
      !Number.isFinite(p.timeMs) ||
      !Number.isFinite(p.storageLitres) ||
      (p.storageLitres as number) < 0 ||
      (p.storageLitres as number) > capacity ||
      p.timeMs !== startTime + i * 86400000
    )
      throw new Error("Invalid forecast trajectory.");
  }
  for (const key of ["warningCrossing", "criticalCrossing"])
    if (r[key] !== null) {
      const crossing = object(r[key]);
      if (
        !Number.isFinite(crossing.day) ||
        !Number.isFinite(crossing.timeMs) ||
        (crossing.day as number) < 0 ||
        (crossing.day as number) > horizon
      )
        throw new Error("Invalid crossing.");
    }
  return r as unknown as ForecastResult;
}
export function parseForecastEnvelope(raw: unknown): ForecastEnvelope {
  const value = object(raw),
    input = object(value.input);
  for (const key of [
    "capacityLitres",
    "startingStorageLitres",
    "dailySupplyLitres",
    "dailyDemandLitres",
    "dailyAnomalyLossLitres",
    "warningReserveLitres",
    "criticalReserveLitres",
    "horizonDays",
    "startTimeMs",
  ])
    if (!Number.isFinite(input[key]))
      throw new Error("Missing forecast input field.");
  if (![7, 14, 30].includes(input.horizonDays as number))
    throw new Error("Unsupported forecast horizon.");
  validateInput(input as unknown as ForecastEnvelope["input"]);
  if (
    value.campusId !== campusId ||
    !Number.isSafeInteger(value.campusVersion) ||
    (value.campusVersion as number) < 1 ||
    !isExecution(value.execution) ||
    !validTimestamp(value.executedAt)
  )
    throw new Error("Invalid forecast metadata.");
  const comparison = object(value.comparison);
  for (const key of [
    "resilienceHours",
    "waterPreservedLitres",
    "comparisonDay",
  ])
    if (comparison[key] !== null && !Number.isFinite(comparison[key]))
      throw new Error("Invalid comparison.");
  return {
    campusId,
    campusVersion: value.campusVersion as number,
    input: input as unknown as ForecastEnvelope["input"],
    baseline: forecastResult(
      value.baseline,
      input.horizonDays as number,
      input.capacityLitres as number,
      input.startTimeMs as number,
    ),
    comparison: {
      baseline: forecastResult(
        comparison.baseline,
        30,
        input.capacityLitres as number,
        input.startTimeMs as number,
      ),
      intervention: forecastResult(
        comparison.intervention,
        30,
        input.capacityLitres as number,
        input.startTimeMs as number,
      ),
      resilienceHours: comparison.resilienceHours as number | null,
      waterPreservedLitres: comparison.waterPreservedLitres as number | null,
      comparisonDay: comparison.comparisonDay as number | null,
    },
    executedAt: value.executedAt,
    execution: value.execution,
  };
}
export function clipForecast(
  result: ForecastResult,
  horizon: number,
): ForecastResult {
  if (![7, 14, 30].includes(horizon) || horizon > result.horizonDays)
    throw new RangeError("Unsupported chart horizon.");
  const points = result.points.slice(0, horizon + 1);
  return {
    ...result,
    points,
    horizonDays: horizon,
    minimumStorageLitres: Math.min(...points.map((p) => p.storageLitres)),
    warningCrossing:
      result.warningCrossing && result.warningCrossing.day <= horizon
        ? result.warningCrossing
        : null,
    criticalCrossing:
      result.criticalCrossing && result.criticalCrossing.day <= horizon
        ? result.criticalCrossing
        : null,
  };
}
function parseEnvironment(raw: unknown): EnvironmentalResult {
  const r = object(raw);
  if (
    !["available", "cached", "unavailable"].includes(r.status as string) ||
    !validTimestamp(r.attemptedAt) ||
    ![null, "fresh", "aging", "stale"].includes(r.freshness as string | null) ||
    ![null, "timeout", "rate-limit", "invalid-data", "unavailable"].includes(
      r.issue as string | null,
    )
  )
    throw new Error("Invalid environmental response.");
  if (r.status === "unavailable") {
    if (r.snapshot !== null || r.freshness !== null)
      throw new Error("Unavailable response must not substitute values.");
  } else {
    const s = object(r.snapshot),
      source = object(s.source),
      location = object(s.location),
      grid = object(s.grid);
    if (
      !validTimestamp(s.fetchedAt) ||
      !validTimestamp(s.latestAvailableEstimate) ||
      s.observationTimestamp !== null ||
      s.modelRunTimestamp !== null ||
      typeof source.name !== "string" ||
      typeof source.url !== "string" ||
      typeof source.resolution !== "string" ||
      typeof source.update !== "string" ||
      typeof location.name !== "string" ||
      !Number.isFinite(grid.latitude) ||
      !Number.isFinite(grid.longitude)
    )
      throw new Error("Invalid environmental provenance.");
    for (const key of ["recentRain", "forecastPrecipitation"]) {
      const indicator = object(s[key]);
      if (
        !Number.isFinite(indicator.value) ||
        (indicator.value as number) < 0 ||
        indicator.unit !== "mm" ||
        indicator.kind !== (key === "recentRain" ? "estimated" : "forecast") ||
        !validTimestamp(indicator.start) ||
        !validTimestamp(indicator.end) ||
        Date.parse(indicator.end) - Date.parse(indicator.start) !== 86400000
      )
        throw new Error("Invalid environmental indicator.");
    }
  }
  return r as unknown as EnvironmentalResult;
}
export interface EnvironmentClientResult {
  data: EnvironmentalResult;
  boundary:
    | "LOCAL API"
    | "AWS LAMBDA"
    | "LOCAL BACKEND TEST"
    | "LOCAL API · AWS UNAVAILABLE";
}
export function createApiClient(
  options: {
    baseUrl?: string;
    fetcher?: typeof fetch;
    timeoutMs?: number;
  } = {},
) {
  const base = (options.baseUrl ?? "").trim().replace(/\/$/, ""),
    fetcher = options.fetcher ?? fetch;
  let configurationValid = true;
  if (base) {
    if (base === "/api/sample-demo") configurationValid = true;
    else {
    try {
      const url = new URL(base);
      configurationValid =
        (url.protocol === "https:" ||
          (url.protocol === "http:" &&
            ["127.0.0.1", "localhost"].includes(url.hostname))) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash;
    } catch {
      configurationValid = false;
    }
    }
  }
  async function request(
    path: string,
    method = "GET",
    payload?: unknown,
    local = false,
  ): Promise<unknown> {
    if (!local && (!base || !configurationValid))
      throw new ApiError(
        "CONFIGURATION",
        0,
        "A valid HTTPS backend URL is required; local demo remains active.",
      );
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const work = async () => {
      const proxyPath = path.startsWith("/campus/") ? "/campus" : path.startsWith("/environment/") ? "/environment" : path;
      const response = await fetcher((local ? "" : base) + (!local && base === "/api/sample-demo" ? proxyPath : path), {
        method,
        ...(payload === undefined ? {} : await jsonBody(payload)),
        cache: "no-store",
        credentials: base === "/api/sample-demo" ? "same-origin" : "omit",
        signal: controller.signal,
      });
      const raw: unknown = await response.json();
      if (!response.ok) {
        const value = object(raw),
          error = object(value.error);
        const code =
          typeof error.code === "string" && error.code in errorMessages
            ? error.code
            : "BACKEND_UNAVAILABLE";
        throw new ApiError(code, response.status, errorMessages[code]);
      }
      return raw;
    };
    try {
      return await Promise.race([
        work(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(
              new ApiError(
                "TIMEOUT",
                0,
                "Backend request timed out. A timed-out save may have reached the backend; reload its state before retrying.",
              ),
            );
          }, options.timeoutMs ?? 20000);
        }),
      ]);
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      throw new ApiError(
        "BACKEND_UNAVAILABLE",
        0,
        "Backend unavailable or invalid response. Local demo remains usable.",
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async function checked<T>(
    promise: Promise<unknown>,
    parse: (raw: unknown) => T,
  ): Promise<T> {
    try {
      return parse(await promise);
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      throw new ApiError(
        "INVALID_RESPONSE",
        0,
        "Backend returned invalid data. Local demo remains usable.",
      );
    }
  }
  return {
    configured: Boolean(base),
    loadCampus: () =>
      checked(request(`/campus/${campusId}`), parseCampusEnvelope),
    saveCampus: (
      values: OperationalValues,
      expectedVersion: number,
      resetToDemo = false,
    ) =>
      checked(
        request(`/campus/${campusId}`, "PUT", {
          values,
          expectedVersion,
          resetToDemo,
        }),
        parseCampusEnvelope,
      ),
    forecast: (expectedVersion: number, horizonDays = 30) =>
      checked(
        request("/forecast", "POST", {
          campusId,
          expectedVersion,
          horizonDays,
        }),
        parseForecastEnvelope,
      ),
    async environment(): Promise<EnvironmentClientResult> {
      if (base) {
        try {
          const envelope = object(await request(`/environment/${campusId}`));
          if (!isExecution(envelope.execution))
            throw new Error("Invalid boundary.");
          return {
            data: parseEnvironment(envelope.environment),
            boundary:
              envelope.execution === "aws-lambda"
                ? "AWS LAMBDA"
                : "LOCAL BACKEND TEST",
          };
        } catch {
          return {
            data: await checked(
              request("/api/environment", "GET", undefined, true),
              parseEnvironment,
            ),
            boundary: "LOCAL API · AWS UNAVAILABLE",
          };
        }
      }
      return {
        data: await checked(
          request("/api/environment", "GET", undefined, true),
          parseEnvironment,
        ),
        boundary: "LOCAL API",
      };
    },
  };
}
export const apiClient = createApiClient({
  // Public Sample Demo is local-only. The authenticated proxy remains separate;
  // browser exploration never loads or saves AWS demo records.
  baseUrl: "",
});
export function backendLabel(
  status: "local" | "loading" | "connected" | "fallback",
  execution?: Execution,
): string {
  return status === "connected"
    ? execution === "local-mock"
      ? "LOCAL BACKEND TEST"
      : execution === "aws-lambda"
        ? "AWS CONNECTED"
        : "BACKEND READY"
    : status === "loading"
      ? "BACKEND CONNECTING"
      : status === "fallback"
        ? "BACKEND UNAVAILABLE · LOCAL DEMO"
        : "LOCAL DEMO";
}
