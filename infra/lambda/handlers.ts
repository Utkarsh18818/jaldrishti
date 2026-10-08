import {
  campusId,
  object,
  parseCampus,
  parseValues,
  campusToState,
  stateToCampus,
} from "../../src/lib/backend-contract.ts";
import type { CampusState, Execution } from "../../src/lib/backend-contract.ts";
import {
  seedOperations,
  updateOperations,
  operationalForecastInput,
} from "../../src/features/system/model.ts";
import {
  forecastStorage,
  compareIntervention,
} from "../../src/features/forecast/model.ts";
import { campusSeed } from "../../src/lib/campus-seed.ts";
import {
  forecastPolicy,
  forecastHorizons,
} from "../../src/features/forecast/policy.ts";
import type { EnvironmentalProvider } from "../../src/features/environment/provider.ts";
import {
  realCampusId,
  createAnalysisCampus,
  parseAnalysisCampus,
  environmentProvenance,
} from "../../src/features/analysis/contract.ts";
import type { AnalysisCampus } from "../../src/features/analysis/contract.ts";
import {
  runAnalysis,
  realForecastInput,
} from "../../src/features/analysis/model.ts";
import type { RealAnalysis } from "../../src/features/analysis/model.ts";
import type { IndexContext } from "../../src/features/analysis/model.ts";
import type { createRegionalProvider } from "../../src/features/analysis/environment.ts";
import { equalSecret } from "../../src/features/analysis/access.ts";
export class ConflictError extends Error {}
export interface CampusRepository {
  get(id: string): Promise<unknown | null>;
  put(campus: CampusState, expectedVersion: number): Promise<void>;
  putAnalysis?(campus: AnalysisCampus, expectedVersion: number): Promise<void>;
}
export interface ApiEvent {
  headers?: Record<string, string | undefined>;
  rawPath: string;
  requestContext: { http: { method: string } };
  body?: string | null;
  isBase64Encoded?: boolean;
}
export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
export function createHandler(dependencies: {
  repository: CampusRepository;
  environment: EnvironmentalProvider;
  now?: () => number;
  execution?: Execution;
  regionalEnvironment?: ReturnType<typeof createRegionalProvider>;
  authorizeReal?: (event: ApiEvent) => boolean;
}) {
  const clock = dependencies.now ?? Date.now,
    execution = dependencies.execution ?? "aws-lambda";
  function response(statusCode: number, value: unknown): ApiResponse {
    return {
      statusCode,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      body: JSON.stringify(value),
    };
  }
  function error(status: number, code: string, message: string) {
    return response(status, { error: { code, message } });
  }
  function body(event: ApiEvent, limit = 10000) {
    if (!event.body || Buffer.byteLength(event.body) > limit * 2)
      throw new RangeError("Missing or oversized request body.");
    const text = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    if (Buffer.byteLength(text) > limit)
      throw new RangeError("Request body too large.");
    try {
      return object(JSON.parse(text));
    } catch {
      throw new RangeError("Invalid JSON request body.");
    }
  }
  async function readCampus(): Promise<CampusState | null> {
    const stored = await dependencies.repository.get(campusId);
    if (!stored) return null;
    try {
      return parseCampus(stored);
    } catch {
      throw new Error("Invalid stored campus state");
    }
  }
  return async (event: ApiEvent): Promise<ApiResponse> => {
    try {
      const method = event.requestContext.http.method,
        path = event.rawPath;
      const campusRoute = path.match(/^\/(campus|environment)\/([^/]+)$/);
      // Schema v2 real-site path never calls the legacy seed adapter.
      const forecastRequest =
        path === "/forecast" && method === "POST" ? body(event) : null;
      if (
        campusRoute?.[2] === realCampusId ||
        forecastRequest?.campusId === realCampusId
      ) {
        const authorize = dependencies.authorizeReal ?? ((request: ApiEvent) => {
          const token = process.env.JALDRISHTI_BACKEND_TOKEN ?? "";
          const provided = Object.entries(request.headers ?? {}).find(([name]) => name.toLowerCase() === "x-jaldrishti-access-token")?.[1] ?? "";
          return token.length >= 32 && equalSecret(provided, token);
        });
        if (!authorize(event)) return error(401, "UNAUTHORIZED", "Private access is required for Real Analysis.");
        const stored = await dependencies.repository.get(realCampusId);
        let campus: AnalysisCampus | null = null;
        if (stored) {
          try {
            campus = parseAnalysisCampus(stored);
          } catch {
            throw new Error("Invalid stored real analysis");
          }
        }
        if (campusRoute?.[1] === "campus" && method === "PUT") {
          const request = body(event, 300000);
          if (
            Object.keys(request).some(
              (k) => !["analysis", "expectedVersion"].includes(k),
            ) ||
            !Number.isSafeInteger(request.expectedVersion) ||
            (request.expectedVersion as number) < 0
          )
            throw new RangeError("Provide analysis and expectedVersion.");
          if ((campus?.version ?? 0) !== request.expectedVersion)
            throw new ConflictError();
          const next = createAnalysisCampus(
            request.analysis as RealAnalysis,
            (request.expectedVersion as number) + 1,
            clock(),
          );
          if (dependencies.regionalEnvironment) {
            try {
              next.environmentalProvenance = environmentProvenance(
                await dependencies.regionalEnvironment.load(
                  next.analysis.location.value,
                ),
              );
            } catch {
              /* Operational saves do not depend on weather availability. Empty metadata is explicit absence. */
            }
          }
          if (!dependencies.repository.putAnalysis)
            throw new Error("Real persistence not configured");
          await dependencies.repository.putAnalysis(
            next,
            request.expectedVersion as number,
          );
          return response(campus ? 200 : 201, { campus: next, execution });
        }
        if (!campus)
          return error(
            404,
            "NOT_FOUND",
            "Real site is uninitialized. No demo data is substituted.",
          );
        if (campusRoute?.[1] === "campus" && method === "GET")
          return response(200, { campus, execution });
        if (campusRoute?.[1] === "environment" && method === "GET") {
          if (!dependencies.regionalEnvironment)
            throw new Error("Regional provider not configured");
          return response(200, {
            environment: await dependencies.regionalEnvironment.load(
              campus.analysis.location.value,
            ),
            execution,
          });
        }
        if (forecastRequest) {
          if (
            Object.keys(forecastRequest).some(
              (k) =>
                !["campusId", "expectedVersion", "horizonDays"].includes(k),
            ) ||
            !forecastHorizons.includes(
              forecastRequest.horizonDays as 7 | 14 | 30,
            ) ||
            !Number.isSafeInteger(forecastRequest.expectedVersion)
          )
            throw new RangeError("Invalid forecast metadata.");
          if (campus.version !== forecastRequest.expectedVersion)
            throw new ConflictError();
          const input = realForecastInput(
            campus.analysis,
            forecastRequest.horizonDays as number,
          );
          let indexContext: IndexContext = {};
          if (dependencies.regionalEnvironment) {
            try {
              const regional = await dependencies.regionalEnvironment.load(
                campus.analysis.location.value,
              );
              const h = regional.history;
              if (
                h.status === "available" &&
                h.data?.ratio &&
                clock() - Date.parse(h.data.retrievedAt) < 86400000
              )
                indexContext = {
                  rainfallRatio: h.data.ratio.value,
                  rainfallProvenance: h.data.ratio.provenance,
                };
            } catch {
              /* Missing context is excluded from the index, never substituted. */
            }
          }
          return response(200, {
            campusId: realCampusId,
            campusVersion: campus.version,
            input,
            baseline: forecastStorage(input),
            analysis: runAnalysis(campus.analysis, indexContext),
            executedAt: new Date(clock()).toISOString(),
            execution,
          });
        }
        return error(404, "NOT_FOUND", "Endpoint not found.");
      }
      if (campusRoute && campusRoute[2] !== campusId)
        return error(
          404,
          "NOT_FOUND",
          "Only the configured demo campus is supported.",
        );
      if (campusRoute?.[1] === "campus" && method === "GET") {
        const campus = await readCampus();
        return campus
          ? response(200, { campus, execution })
          : error(
              404,
              "NOT_FOUND",
              "Campus is not initialized. Apply System inputs to create the demo record.",
            );
      }
      if (campusRoute?.[1] === "campus" && method === "PUT") {
        const request = body(event);
        if (
          Object.keys(request).some(
            (key) =>
              !["values", "expectedVersion", "resetToDemo"].includes(key),
          ) ||
          !Number.isSafeInteger(request.expectedVersion) ||
          (request.expectedVersion as number) < 0 ||
          (request.resetToDemo !== undefined &&
            typeof request.resetToDemo !== "boolean")
        )
          throw new RangeError("Invalid campus write metadata.");
        const values = parseValues(request.values),
          previous = await readCampus();
        if ((previous?.version ?? 0) !== request.expectedVersion)
          throw new ConflictError();
        const now = clock();
        let state = updateOperations(
          previous ? campusToState(previous) : seedOperations(),
          values,
          now,
        );
        if (request.resetToDemo) {
          const seed = seedOperations();
          if (JSON.stringify(values) !== JSON.stringify(seed.values))
            throw new RangeError("Demo reset must use seed values.");
          state = seed;
        }
        const campus = stateToCampus(
          state,
          (request.expectedVersion as number) + 1,
          now,
        );
        await dependencies.repository.put(
          campus,
          request.expectedVersion as number,
        );
        return response(previous ? 200 : 201, { campus, execution });
      }
      if (path === "/forecast" && method === "POST") {
        const request = body(event);
        if (
          Object.keys(request).some(
            (key) =>
              !["campusId", "horizonDays", "expectedVersion"].includes(key),
          ) ||
          request.campusId !== campusId ||
          !forecastHorizons.includes(request.horizonDays as 7 | 14 | 30) ||
          !Number.isSafeInteger(request.expectedVersion)
        )
          throw new RangeError(
            "Forecast requires campusId, horizon 7/14/30 and expectedVersion.",
          );
        const campus = await readCampus();
        if (!campus)
          return error(
            404,
            "NOT_FOUND",
            "Save campus inputs before requesting an AWS forecast.",
          );
        if (campus.version !== request.expectedVersion)
          throw new ConflictError();
        const state = campusToState(campus),
          input = operationalForecastInput(
            state.values,
            request.horizonDays as number,
          );
        return response(200, {
          campusId,
          campusVersion: campus.version,
          input,
          baseline: forecastStorage(input),
          comparison: compareIntervention(
            { ...input, horizonDays: forecastPolicy.comparisonHorizonDays },
            campusSeed.reductionPercent,
          ),
          executedAt: new Date(clock()).toISOString(),
          execution,
        });
      }
      if (campusRoute?.[1] === "environment" && method === "GET") {
        const campus = await readCampus();
        if (!campus)
          return error(
            404,
            "NOT_FOUND",
            "Save campus inputs before requesting campus environmental context.",
          );
        return response(200, {
          environment: await dependencies.environment.load(),
          execution,
        });
      }
      return error(404, "NOT_FOUND", "Endpoint not found.");
    } catch (cause) {
      if (cause instanceof ConflictError)
        return error(
          409,
          "CONFLICT",
          "Campus changed. Reload AWS state before saving again.",
        );
      if (cause instanceof RangeError)
        return error(400, "INVALID_INPUT", cause.message);
      return error(
        503,
        "BACKEND_UNAVAILABLE",
        "Backend temporarily unavailable. Use local demo mode or retry later.",
      );
    }
  };
}
