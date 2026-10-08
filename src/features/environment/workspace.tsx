"use client";
import { useEffect, useState } from "react";
import { Eyebrow, Panel } from "@/components/ui";
import {
  classifyFreshness,
  demoEnvironment,
  environmentalLocation,
} from "./model";
import type { EnvironmentalResult } from "./model";
import { apiClient } from "@/lib/api-client";
const time = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value)) + " IST";
export function EnvironmentalWorkspace() {
  const [result, setResult] = useState<EnvironmentalResult | null>(() =>
    demoEnvironment(Date.parse("2026-10-07T08:00:00Z")),
  );
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"api" | "demo">("demo");
  const [revision, setRevision] = useState(0);
  const [clock, setClock] = useState<number | null>(null);
  const [boundary, setBoundary] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (mode === "demo") return;
    let active = true;
    apiClient
      .environment()
      .then(({ data, boundary }) => {
        if (active) {
          setBoundary(boundary);
          setResult(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setResult({
            status: "unavailable",
            snapshot: null,
            freshness: null,
            attemptedAt: new Date().toISOString(),
            issue: "unavailable",
          });
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [mode, revision]);
  const snapshot = result?.snapshot;
  const freshness =
    snapshot && mode !== "demo" && clock !== null
      ? classifyFreshness(snapshot, clock)
      : result?.freshness;
  function switchMode(next: "api" | "demo") {
    setMode(next);
    setLoading(next === "api");
    setResult(next === "demo" ? demoEnvironment(Date.now()) : null);
    if (next === "api") setRevision((v) => v + 1);
  }
  return (
    <>
      <div className="overview-heading">
        <div>
          <Eyebrow>ENVIRONMENTAL INTELLIGENCE</Eyebrow>
          <h1>
            Data<span>.</span>
          </h1>
          <p>Regional weather context. A separate operational water balance.</p>
        </div>
        <span className="preview-label">
          {mode === "demo" ? "OFFLINE DEMO" : "PUBLIC MODEL DATA"}
        </span>
      </div>
      <Panel className="environment-panel">
        <div className="environment-heading">
          <div>
            <Eyebrow>REGIONAL CONTEXT</Eyebrow>
            <h2>{environmentalLocation.name}</h2>
            <p>
              18.5204° N · 73.8567° E · Example coordinates, not a verified
              campus location
            </p>
            <p>
              Pune Demo Campus uses this example region for context; operational
              inputs remain local/demo assumptions.
            </p>
          </div>
          <div className="environment-actions">
            <button
              className="button secondary"
              disabled={loading}
              onClick={() => switchMode("api")}
            >
              {loading ? "Fetching…" : "Refresh public data"}
            </button>
            <button
              className="button secondary"
              aria-pressed={mode === "demo"}
              onClick={() => switchMode("demo")}
            >
              Offline demo
            </button>
          </div>
        </div>
        <p className="environment-status" role="status">
          {loading
            ? "Requesting Open-Meteo data…"
            : result?.status === "demo"
              ? "DEMO · Illustrative values · Not downloaded observations"
              : result?.status === "unavailable"
                ? "UNAVAILABLE · Live context requires operator access; no values substituted"
                : `${result?.status === "cached" ? "LAST SUCCESSFUL RESPONSE" : "PUBLIC API RESPONSE"} · ${freshness?.toUpperCase()}`}
          {result?.issue && result.issue !== "offline-demo"
            ? ` · ${result.issue}`
            : ""}
        </p>
        {mode !== "demo" && boundary && (
          <p className="environment-note">
            Retrieval boundary: {boundary}. Environmental values remain regional
            model context.
          </p>
        )}
        {snapshot ? (
          <>
            <dl className="environment-indicators">
              {[
                {
                  label: "Recent rainfall · Past 24 hours",
                  indicator: snapshot.recentRain,
                },
                {
                  label: "Forecast precipitation · Next 24 hours",
                  indicator: snapshot.forecastPrecipitation,
                },
              ].map(({ label, indicator }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {indicator.value.toFixed(1)} <small>mm</small>
                  </dd>
                  <span>
                    {indicator.kind === "demo"
                      ? "DEMO FIXTURE"
                      : indicator.kind === "estimated"
                        ? "MODEL ESTIMATE · NOT A RAIN GAUGE"
                        : "WEATHER FORECAST · RAIN + SHOWERS + SNOW"}
                  </span>
                  <p>
                    {time(indicator.start)} → {time(indicator.end)}
                  </p>
                  <p>
                    Source:{" "}
                    {indicator.kind === "demo"
                      ? "JalDrishti illustrative fixture"
                      : snapshot.source.name}
                  </p>
                </div>
              ))}
            </dl>
            <dl className="environment-provenance">
              <div>
                <dt>Latest past estimate timestamp</dt>
                <dd>{time(snapshot.latestAvailableEstimate)}</dd>
              </div>
              <div>
                <dt>{mode === "demo" ? "Fixture reference" : "Retrieved"}</dt>
                <dd>{time(snapshot.fetchedAt)}</dd>
              </div>
              <div>
                <dt>Last available observation</dt>
                <dd>
                  {mode === "demo"
                    ? "None · Illustrative fixture"
                    : "Not supplied · Model output only"}
                </dd>
              </div>
              <div>
                <dt>Model run / issue time</dt>
                <dd>
                  {mode === "demo"
                    ? "Not applicable · Demo fixture"
                    : "Not supplied by this endpoint"}
                </dd>
              </div>
              <div>
                <dt>
                  {mode === "demo"
                    ? "Example coordinates"
                    : "Returned model grid"}
                </dt>
                <dd>
                  {snapshot.grid.latitude.toFixed(4)}° N ·{" "}
                  {snapshot.grid.longitude.toFixed(4)}° E
                </dd>
              </div>
              <div>
                <dt>Resolution / update</dt>
                <dd>
                  {snapshot.source.resolution}
                  <br />
                  {snapshot.source.update}
                </dd>
              </div>
            </dl>
          </>
        ) : !loading ? (
          <p className="environment-note">
            Weather context is temporarily unavailable. Retry later or
            explicitly select offline demo. Your operational forecast and
            simulator continue to work.
          </p>
        ) : null}
        {result && (
          <p className="environment-note">
            Last request / mode selection: {time(result.attemptedAt)}. Fresh: ≤6
            hours; aging: ≤24 hours; stale: &gt;24 hours, based on retrieval and
            latest past estimate. Cached timestamps never advance on failure.
          </p>
        )}
        <div className="environment-limit">
          <h3>Use weather to plan, not to measure the tank.</h3>
          <p>
            Public data uses regional model values at an approximately 11 km
            grid scale. Recent rainfall is estimated from weather model output;
            it is not a station or campus measurement. Forecast totals can
            change. No rainfall baseline, soil moisture or groundwater condition
            is inferred here.
          </p>
          <p>
            Rain does not alter the tank forecast, simulator or water security
            score. A physical harvesting model would require verified collection
            area, efficiency and delivery timing. The operational model uses
            local/demo inputs and a fixed reference of 7 October 2026; weather
            windows follow the actual request time.
          </p>
          <p>
            {mode === "demo" ? (
              "Offline values are an explicit JalDrishti fixture, not Open-Meteo data."
            ) : (
              <>
                Data attribution:{" "}
                <a
                  href="https://open-meteo.com/en/docs/dwd-api"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open-Meteo / DWD ICON
                </a>{" "}
                ·{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0
                </a>
                . Free API for non-commercial use; no availability guarantee.
              </>
            )}
          </p>
        </div>
      </Panel>
    </>
  );
}
