import { approvedOrigin, boundedBody, cookieValue, equalSecret, issueSession, sessionCookie, sessionSeconds, validSession } from "./access.ts";
import { createAnalysisCampus } from "./contract.ts";
import type { RealAnalysis } from "./model.ts";
import { campusId, parseValues } from "../../lib/backend-contract.ts";
export function createAnalysisGateway(options: {
  baseUrl: string; backendToken: string; accessCode: string; sessionSecret: string;
  origin?: string; fetcher?: typeof fetch; now?: () => number;
}) {
  const clock = options.now ?? Date.now;
  const configured = options.backendToken.length >= 32 && options.accessCode.length >= 32 && options.sessionSecret.length >= 32 && /^https:\/\/[^/?#]+$/.test(options.baseUrl);
  let attempts = 0, resetAt = 0;
  const json = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
  const authenticated = (r: Request) => configured && validSession(cookieValue(r), options.sessionSecret, clock());
  function cookie(request: Request, value: string, age: number) {
    const secure = new URL(options.origin || request.url).protocol === "https:";
    return `${sessionCookie}=${value}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${age}${secure ? "; Secure" : ""}`;
  }
  function sessionResponse(request: Request, value: string, age: number, authenticated: boolean) {
    const response = Response.json({ authenticated }, { headers: { "set-cookie": cookie(request, value, age), "cache-control": "no-store" } });
    // Clear the former narrower cookie so it cannot shadow the shared operator session.
    response.headers.append("set-cookie", `${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/api/real-analysis; Max-Age=0${new URL(options.origin || request.url).protocol === "https:" ? "; Secure" : ""}`);
    return response;
  }
  return {
    authenticated,
    async session(request: Request) {
      if (request.method === "GET") return Response.json({ configured, authenticated: authenticated(request) }, { headers: { "cache-control": "no-store" } });
      if (!approvedOrigin(request, options.origin)) return json(403, "FORBIDDEN", "Same-origin access is required.");
      if (!configured) return json(503, "BACKEND_UNAVAILABLE", "Private cloud access is not configured. Local analysis remains usable.");
      try {
        const body = JSON.parse(await boundedBody(request, 2048));
        if (body.action === "logout") return sessionResponse(request, "", 0, false);
        if (clock() >= resetAt) { attempts = 0; resetAt = clock() + 300000; }
        if (++attempts > 10) return json(429, "RATE_LIMIT", "Too many access attempts. Retry in five minutes.");
        if (typeof body.accessCode !== "string" || !equalSecret(body.accessCode, options.accessCode)) return json(401, "UNAUTHORIZED", "Cloud access code is incorrect.");
        return sessionResponse(request, issueSession(options.sessionSecret, clock()), sessionSeconds, true);
      } catch { return json(400, "INVALID_INPUT", "Invalid access request."); }
    },
    async proxy(request: Request, operation: string, demo = false) {
      if (!configured) return json(503, "BACKEND_UNAVAILABLE", "Private cloud access is not configured.");
      if (!authenticated(request)) return json(401, "UNAUTHORIZED", "Unlock private cloud access first.");
      if (!["campus", "environment", "forecast"].includes(operation) ||
        (operation === "campus" ? !["GET", "PUT"].includes(request.method) : request.method !== (operation === "forecast" ? "POST" : "GET"))) return json(404, "NOT_FOUND", "Endpoint not found.");
      if (["PUT", "POST"].includes(request.method) && !approvedOrigin(request, options.origin)) return json(403, "FORBIDDEN", "Same-origin access is required.");
      try {
        let body: string | undefined;
        if (["PUT", "POST"].includes(request.method)) {
          body = await boundedBody(request, operation === "campus" ? 300000 : 10000);
          const input = JSON.parse(body);
          if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) throw new RangeError();
          if (demo && operation === "campus") {
            if (Object.keys(input).some(k => !["values", "expectedVersion", "resetToDemo"].includes(k)) || typeof input.resetToDemo !== "boolean") throw new RangeError();
            parseValues(input.values);
          } else if (operation === "campus") {
            if (Object.keys(input).some(k => !["analysis", "expectedVersion"].includes(k))) throw new RangeError();
            createAnalysisCampus(input.analysis as RealAnalysis, input.expectedVersion + 1, clock());
          } else if (input.campusId !== (demo ? campusId : "real-site") || ![7, 14, 30].includes(input.horizonDays) || Object.keys(input).some(k => !["campusId", "expectedVersion", "horizonDays"].includes(k))) throw new RangeError();
        }
        const path = operation === "forecast" ? "/forecast" : `/${operation}/${demo ? campusId : "real-site"}`;
        const response = await (options.fetcher ?? fetch)(options.baseUrl + path, {
          method: request.method, body, redirect: "error", cache: "no-store",
          headers: { "content-type": "application/json", "x-jaldrishti-access-token": options.backendToken },
          signal: AbortSignal.timeout(20000),
        });
        const raw: unknown = await response.json();
        if (!response.ok) {
          const codes: Record<number, string> = { 400: "INVALID_INPUT", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 429: "RATE_LIMIT" };
          return json(response.status, codes[response.status] ?? "BACKEND_UNAVAILABLE", "Cloud request was not accepted. Reload before retrying a save.");
        }
        return Response.json(raw, { status: response.status, headers: { "cache-control": "no-store" } });
      } catch (e) {
        return e instanceof RangeError || e instanceof SyntaxError
          ? json(400, "INVALID_INPUT", "Invalid real analysis or request size.")
          : json(503, "BACKEND_UNAVAILABLE", "Cloud unavailable. Local inputs remain usable; reload to reconcile a timed-out save.");
      }
    },
  };
}
