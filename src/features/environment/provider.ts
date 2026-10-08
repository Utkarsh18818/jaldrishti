import {
  classifyFreshness,
  normalizeOpenMeteo,
  environmentalLocation,
} from "./model.ts";
import type { EnvironmentalResult, EnvironmentalSnapshot } from "./model.ts";
export const endpoint =
  "https://api.open-meteo.com/v1/forecast?" +
  new URLSearchParams({
    latitude: String(environmentalLocation.latitude),
    longitude: String(environmentalLocation.longitude),
    hourly: "rain,showers,precipitation",
    models: "icon_global",
    past_days: "2",
    forecast_days: "3",
    timezone: "GMT",
    timeformat: "unixtime",
  });
export interface EnvironmentalProvider {
  load(): Promise<EnvironmentalResult>;
}
export function createProvider(
  options: {
    fetcher?: typeof fetch;
    now?: () => number;
    timeoutMs?: number;
  } = {},
): EnvironmentalProvider {
  const fetcher = options.fetcher ?? fetch,
    clock = options.now ?? Date.now;
  let last: EnvironmentalSnapshot | null = null,
    retryAt = 0;
  let lastIssue: EnvironmentalResult["issue"] = null;
  let pending: Promise<EnvironmentalResult> | null = null;
  async function request(): Promise<EnvironmentalResult> {
    const now = clock(),
      attemptedAt = new Date(now).toISOString();
    if (
      last &&
      now - Date.parse(last.fetchedAt) < 900000 &&
      classifyFreshness(last, now) === "fresh"
    )
      return {
        status: "available",
        snapshot: last,
        freshness: classifyFreshness(last, now),
        attemptedAt,
        issue: null,
      };
    const fallback = (
      issue: EnvironmentalResult["issue"],
    ): EnvironmentalResult => ({
      status: last ? "cached" : "unavailable",
      snapshot: last,
      freshness: last ? classifyFreshness(last, clock()) : null,
      attemptedAt,
      issue,
    });
    if (now < retryAt) return fallback(lastIssue);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const failure: { issue: EnvironmentalResult["issue"] } = {
      issue: "unavailable",
    };
    try {
      const work = async () => {
        const response = await fetcher(endpoint, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          failure.issue =
            response.status === 429 ? "rate-limit" : "unavailable";
          throw new Error("HTTP failure");
        }
        failure.issue = "invalid-data";
        return normalizeOpenMeteo(await response.json(), clock());
      };
      last = await Promise.race([
        work(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            failure.issue = "timeout";
            controller.abort();
            reject(new Error("Timeout"));
          }, options.timeoutMs ?? 8000);
        }),
      ]);
      lastIssue = null;
      return {
        status: "available",
        snapshot: last,
        freshness: classifyFreshness(last, clock()),
        attemptedAt,
        issue: null,
      };
    } catch {
      lastIssue = failure.issue;
      retryAt = clock() + (failure.issue === "rate-limit" ? 300000 : 60000);
      return fallback(failure.issue);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return {
    load() {
      if (!pending)
        pending = request().finally(() => {
          pending = null;
        });
      return pending;
    },
  };
}
