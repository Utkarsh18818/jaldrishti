"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DecisionBrief } from "@/features/decision/panel";
import { Brand, Panel, Eyebrow } from "@/components/ui";
import { StorageChart } from "@/features/forecast/chart";
import {
  evaluateScenario,
  scenarioPresets,
} from "@/features/simulator/adapter";
import type { ScenarioControls } from "@/features/simulator/adapter";
import { parseLocation, valued } from "./provenance";
import type { AnalysisLocation } from "./provenance";
import { parseCSV } from "./records";
import type { ImportSummary } from "./records";
import { runAnalysis } from "./model";
import type { RealAnalysis, ReservePolicy } from "./model";
import type { EnvironmentBundle } from "./environment";
import { importGroundwater } from "./groundwater";
import type { GroundwaterContext } from "./groundwater";
import { realClient, recordsSummary } from "./client";
import type { AnalysisCampus } from "./contract";
import { ApiError } from "@/lib/api-client";
const fields = [
  ["capacity", "Storage capacity (L)"],
  ["storage", "Current storage (L)"],
  ["supply", "Expected daily supply (L/day)"],
  ["population", "Population / occupancy (optional)"],
  ["demand", "Actual daily consumption (L/day)"],
  ["loss", "Additional loss outside entered demand (L/day; enter 0 if none)"],
  ["fraction", "Essential demand fraction (%)"],
  ["hours", "Essential reserve hours"],
  ["warningHours", "Warning reserve hours"],
  ["volume", "Essential reserve volume (L)"],
] as const;
type Draft = Record<(typeof fields)[number][0] | "reading", string>;
const empty: Draft = {
  capacity: "",
  storage: "",
  supply: "",
  population: "",
  demand: "",
  loss: "",
  fraction: "",
  hours: "",
  warningHours: "",
  volume: "",
  reading: "",
};
type Result = ReturnType<typeof runAnalysis>;
const litres = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: 1 }) + " L";
export function AnalysisWorkspace() {
  const [tab, setTab] = useState("Setup"),
    [loc, setLoc] = useState({
      name: "",
      latitude: "",
      longitude: "",
      timezone: "",
    }),
    [location, setLocation] = useState<AnalysisLocation | null>(null),
    [draft, setDraft] = useState(empty),
    [demandMethod, setDemandMethod] = useState<"entered" | "history">(
      "entered",
    ),
    [reserveKind, setReserveKind] =
      useState<ReservePolicy["kind"]>("essential-hours"),
    [csv, setCsv] = useState(""),
    [summary, setSummary] = useState<ImportSummary | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [analysis, setAnalysis] = useState<RealAnalysis | null>(null),
    [error, setError] = useState(""),
    [environment, setEnvironment] = useState<EnvironmentBundle | null>(null),
    [envStatus, setEnvStatus] = useState("USER INPUT REQUIRED"),
    [controls, setControls] = useState<ScenarioControls>({
      ...scenarioPresets.baseline,
    }),
    [groundwater, setGroundwater] = useState<GroundwaterContext | null>(null),
    [gwText, setGwText] = useState("");
  const requestId = useRef(0);
  const sourceAnalysis = useRef<RealAnalysis | null>(null);
  const [cloudStatus, setCloudStatus] = useState<"loading" | "saving" | "saved" | "unsaved" | "empty" | "locked" | "unavailable" | "conflict">("loading");
  const [cloudMessage, setCloudMessage] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [campus, setCampus] = useState<AnalysisCampus | null>(null);
  const [knownVersion, setKnownVersion] = useState<number | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [forecastBoundary, setForecastBoundary] = useState("LOCAL DETERMINISTIC ENGINE");
  const cloudBusy = cloudStatus === "loading" || cloudStatus === "saving";
  const applyCampus = useCallback((saved: AnalysisCampus) => {
    const a = saved.analysis, l = a.location.value, p = a.reserve.value;
    requestId.current++;
    sourceAnalysis.current = a;
    setCampus(saved);
    setKnownVersion(saved.version);
    setAnalysis(a);
    setLocation(l);
    setLoc({ name: l.name, latitude: String(l.latitude), longitude: String(l.longitude), timezone: l.timezone });
    setDraft({ capacity: String(a.capacity.value), storage: String(a.storage.value), supply: String(a.supply.value), population: a.population ? String(a.population.value) : "", demand: a.demand ? String(a.demand.value) : "", loss: String(a.additionalLoss.value), fraction: String(p.essentialFraction * 100), hours: String(p.essentialReserveHours), warningHours: String(p.warningReserveHours), volume: String(p.volumeLitres), reading: a.readingTimestamp });
    setDemandMethod(a.demandMethod);
    setReserveKind(p.kind);
    setSummary(recordsSummary(a.records));
    setCsv("");
    setGroundwater(null);
    setEnvironment(null);
    setEnvStatus("LOADING AWS REGIONAL DATA");
    setResult(runAnalysis(a));
    setForecastBoundary("LOCAL ENGINE · AWS VERIFICATION PENDING");
    setControls({ ...scenarioPresets.baseline });
    setCloudStatus("saved");
    setNeedsReload(false);
    setError("");
  }, []);
  const refreshSaved = useCallback(async (saved: AnalysisCampus, active: () => boolean = () => true) => {
    const id = requestId.current;
    try {
      const e = await realClient.environment(saved);
      if (active() && id === requestId.current) {
        setEnvironment(e);
        setEnvStatus(e.weather.status === "unavailable" ? "AWS REGIONAL DATA UNAVAILABLE · No substitute" : "AWS REGIONAL MODEL DATA");
      }
    } catch {
      if (active() && id === requestId.current) setEnvStatus("AWS REGIONAL DATA UNAVAILABLE · No substitute");
    }
    try {
      const calculated = await realClient.forecast(saved);
      if (active() && id === requestId.current) { setResult(calculated); setForecastBoundary("AWS LAMBDA · VERIFIED SHARED ENGINE"); }
    } catch {
      if (active() && id === requestId.current) setForecastBoundary("LOCAL ENGINE · AWS FORECAST UNAVAILABLE");
    }
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await realClient.session();
        if (!active) return;
        setUnlocked(session.authenticated);
        if (!session.authenticated) {
          setCloudStatus(session.configured ? "locked" : "unavailable");
          setCloudMessage(session.configured ? "Unlock to load your private saved analysis. Local calculation remains available." : "Private cloud access is not configured. Local calculation remains available.");
          return;
        }
        const saved = await realClient.load();
        if (!active) return;
        applyCampus(saved);
        setCloudMessage(`Loaded AWS revision ${saved.version}. Inputs, records and provenance restored.`);
        void refreshSaved(saved, () => active);
      } catch (e) {
        if (!active) return;
        if (e instanceof ApiError && e.code === "NOT_FOUND") { setKnownVersion(0); setCloudStatus("empty"); setCloudMessage("No saved Real Analysis. Start with your own inputs."); }
        else { setCloudStatus("unavailable"); setCloudMessage((e as Error).message); }
      }
    })();
    return () => { active = false; };
  }, [applyCampus, refreshSaved]);
  function markDirty() {
    requestId.current++;
    setForecastBoundary("LOCAL DETERMINISTIC ENGINE");
    if (unlocked && !needsReload) setCloudStatus("unsaved");
    setCloudMessage("Changes are local until you run the analysis and explicitly save to AWS.");
  }
  function cloudFailure(e: unknown) {
    const error = e as ApiError;
    const reconcile = ["CONFLICT", "TIMEOUT", "BACKEND_UNAVAILABLE", "INVALID_RESPONSE"].includes(error.code);
    setNeedsReload(reconcile);
    setCloudStatus(error.code === "CONFLICT" ? "conflict" : error.code === "UNAUTHORIZED" ? "locked" : "unavailable");
    if (error.code === "UNAUTHORIZED") setUnlocked(false);
    setCloudMessage(error.message);
  }
  async function reloadCloud() {
    setCloudStatus("loading");
    try {
      const saved = await realClient.load();
      applyCampus(saved);
      setCloudMessage(`Saved revision ${saved.version} · ${saved.updatedAt}. Reload replaced local edits.`);
      void refreshSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && e.code === "NOT_FOUND") { setCampus(null); setKnownVersion(0); setNeedsReload(false); setCloudStatus("empty"); setCloudMessage("No saved Real Analysis. Your local edits remain available."); }
      else cloudFailure(e);
    }
  }
  async function unlockCloud() {
    setCloudStatus("loading");
    try {
      await realClient.unlock(accessCode);
      setAccessCode("");
      setUnlocked(true);
      await reloadCloud();
    } catch (e) { setAccessCode(""); cloudFailure(e); }
  }
  async function saveCloud() {
    if (!analysis || knownVersion === null || needsReload) return;
    setCloudStatus("saving");
    try {
      const saved = await realClient.save(analysis, knownVersion);
      applyCampus(saved);
      setCloudMessage(`Saved AWS revision ${saved.version} · ${saved.updatedAt}. Reload will restore these inputs and accepted records.`);
      void refreshSaved(saved);
    } catch (e) { cloudFailure(e); }
  }
  async function lockCloud() {
    try {
      await realClient.lock(); setUnlocked(false); setCloudStatus("locked"); setKnownVersion(null);
      setCloudMessage("Cloud access locked. Current inputs remain in this browser session only.");
    } catch (e) { cloudFailure(e); }
  }
  function change(key: keyof Draft, value: string) {
    markDirty();
    setDraft((d) => ({ ...d, [key]: value }));
    setResult(null);
    setAnalysis(null);
    setError("");
  }
  async function loadEnvironment(l: AnalysisLocation) {
    if (unlocked && campus && analysis && JSON.stringify(analysis) === JSON.stringify(campus.analysis) && JSON.stringify(l) === JSON.stringify(campus.analysis.location.value)) {
      await refreshSaved(campus);
      return;
    }
    const id = ++requestId.current;
    setEnvStatus("LOADING REGIONAL DATA");
    setEnvironment(null);
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch(
        "/api/analysis-environment?" +
          new URLSearchParams({
            name: l.name,
            latitude: String(l.latitude),
            longitude: String(l.longitude),
            timezone: l.timezone,
          }),
        { signal: controller.signal },
      );
      if (!r.ok) throw new Error();
      const data: EnvironmentBundle = await r.json();
      if (id === requestId.current) {
        setEnvironment(data);
        setEnvStatus(
          data.weather.status === "unavailable"
            ? "UNAVAILABLE"
            : "LOCAL API · REGIONAL MODEL DATA",
        );
      }
    } catch {
      if (id === requestId.current)
        setEnvStatus("UNAVAILABLE · No demo substitute");
    } finally {
      clearTimeout(timer);
    }
  }
  function saveLocation() {
    markDirty();
    try {
      const l = parseLocation({
        name: loc.name,
        latitude: loc.latitude.trim() ? Number(loc.latitude) : NaN,
        longitude: loc.longitude.trim() ? Number(loc.longitude) : NaN,
        timezone: loc.timezone,
      });
      setLocation(l);
      setResult(null);
      setAnalysis(null);
      setGroundwater(null);
      setError("");
      void loadEnvironment(l);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function importRecords(text = csv) {
    markDirty();
    try {
      setSummary(parseCSV(text));
      setResult(null);
      setAnalysis(null);
      setError("");
    } catch (e) {
      setSummary(null);
      setError((e as Error).message);
    }
  }
  function run() {
    try {
      if (!location) throw new RangeError("Set your location first.");
      const number = (key: keyof Draft) => {
        if (!draft[key].trim())
          throw new RangeError(
            "Required: " + (fields.find((f) => f[0] === key)?.[1] ?? key),
          );
        const n = Number(draft[key]);
        if (!Number.isFinite(n)) throw new RangeError("Invalid number: " + key);
        return n;
      };
      if (!draft.reading.trim())
        throw new RangeError("Reading timestamp with timezone is required.");
      const reading = draft.reading,
        time = new Date().toISOString(),
        user = (key: keyof Draft) =>
          valued(
            number(key),
            "USER_PROVIDED",
            "Local operational input",
            key === "storage" ? reading : time,
          );
      const a: RealAnalysis = {
        mode: "REAL_ANALYSIS",
        location: valued(
          location,
          "USER_PROVIDED",
          "Selected site coordinates",
          time,
        ),
        readingTimestamp: reading,
        capacity: user("capacity"),
        storage: user("storage"),
        supply: user("supply"),
        population: draft.population.trim() ? user("population") : null,
        demand: demandMethod === "entered" ? user("demand") : null,
        demandMethod,
        records: summary?.records ?? [],
        additionalLoss: user("loss"),
        reserve: valued(
          {
            kind: reserveKind,
            essentialFraction: number("fraction") / 100,
            essentialReserveHours: number("hours"),
            warningReserveHours: number("warningHours"),
            volumeLitres: reserveKind === "volume" ? number("volume") : 0,
          },
          "USER_PROVIDED",
          "User-selected operational reserve policy",
          time,
        ),
      };
      // Preserve the original input provenance when restored values are unchanged.
      const previous = sourceAnalysis.current;
      if (previous) for (const key of ["location", "capacity", "storage", "supply", "population", "demand", "additionalLoss", "reserve"] as const) {
        if (JSON.stringify(a[key]?.value) === JSON.stringify(previous[key]?.value) && (key !== "storage" || reading === previous.readingTimestamp)) Object.assign(a, { [key]: previous[key] });
      }
      const history = environment?.history;
      const context =
        history?.status === "available" &&
        history.data?.ratio &&
        Date.parse(time) - Date.parse(history.data.retrievedAt) < 86400000
          ? {
              rainfallRatio: history.data.ratio.value,
              rainfallProvenance: history.data.ratio.provenance,
            }
          : {};
      setResult(runAnalysis(a, context));
      setAnalysis(a);
      sourceAnalysis.current = a;
      markDirty();
      setControls({ ...scenarioPresets.baseline });
      setTab("Results");
      setError("");
    } catch (e) {
      setResult(null);
      setAnalysis(null);
      setError((e as Error).message);
    }
  }
  const scenario = result ? evaluateScenario(result.input, controls, 30) : null;
  function time(ms: number | null | undefined) {
    return ms == null
      ? "No crossing within 30 days"
      : new Intl.DateTimeFormat("en-IN", {
          timeZone: location!.timezone,
          dateStyle: "medium",
          timeStyle: "short",
        }).format(ms) +
          " " +
          location!.timezone;
  }
  const tabs = [
    "Setup",
    "Results",
    "Forecast",
    "Simulator",
    "Data & provenance",
  ];
  return (
    <div className="dashboard analysis-workspace">
      <aside className="sidebar">
        <Brand />
        <p className="sidebar-label">REAL ANALYSIS</p>
        <div className="location">
          <div>
            {location?.name ?? "Your site"}
            <small>
              {location
                ? `${location.latitude}, ${location.longitude}`
                : "Location required"}
            </small>
          </div>
        </div>
        <nav aria-label="Analysis workspace" className="analysis-navigation">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>No synthetic decision inputs</p>
          <Link href="/dashboard">Explore Pune Sample Demo ↗</Link>
          <Link href="/">Choose mode ↗</Link>
        </div>
      </aside>
      <div className="dashboard-body">
        <header className="dashboard-top">
          <span>{location?.name ?? "Set up your site"}</span>
          <span className="preview-label">REAL ANALYSIS · {cloudStatus.toUpperCase()}</span>
        </header>
        <main id="main" className="dashboard-main">
          <Eyebrow>WATER SYSTEM INTELLIGENCE</Eyebrow>
          <h1>
            {tab === "Setup"
              ? "Analyze your site."
              : tab === "Results"
                ? "Water security."
                : tab === "Data & provenance"
                  ? "Data & provenance."
                  : tab + "."}
          </h1>
          <p className="analysis-intro">
            User operational readings and regional environmental context. No
            campus sensors or synthetic operational defaults.
          </p>
          <nav className="analysis-tabs" aria-label="Analysis views">
            {tabs.map((t) => (
              <button
                key={t}
                className={tab === t ? "button" : "button secondary"}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </nav>
          {tab === "Setup" && <div className="setup-guide"><p>Calculate locally in three steps. Cloud access is optional.</p><ol><li>Confirm your site location.</li><li>Enter actual readings or import daily records.</li><li>Choose reserves, then run the analysis.</li></ol><a href="#cloud-access">Already have a saved site? Open cloud access ↓</a></div>}
          {error && (
            <p role="alert" className="system-error">
              {error}
            </p>
          )}
          <fieldset disabled={cloudBusy} aria-label="Real Analysis inputs and results" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          {tab === "Setup" && (
            <>
              <Panel className="analysis-panel">
                <Eyebrow>01 · LOCATION</Eyebrow>
                <h2>Where is your site?</h2>
                <p>
                  Coordinates drive public regional weather requests.
                  Operational readings remain local until you explicitly save
                  the validated analysis to your private cloud record.
                </p>
                <div className="analysis-fields">
                  {(["name", "latitude", "longitude", "timezone"] as const).map(
                    (key) => (
                      <label className="system-field" key={key}>
                        {
                          {
                            name: "Location name",
                            latitude: "Latitude (°)",
                            longitude: "Longitude (°)",
                            timezone: "IANA timezone",
                          }[key]
                        }
                        <input
                          value={loc[key]}
                          placeholder={
                            key === "timezone" ? "e.g. Asia/Kolkata" : undefined
                          }
                          onChange={(e) => {
                            markDirty();
                            setLoc({ ...loc, [key]: e.target.value });
                            setLocation(null);
                            setGroundwater(null);
                            setResult(null);
                            setAnalysis(null);
                            setEnvironment(null);
                            setEnvStatus("USER INPUT REQUIRED");
                            requestId.current++;
                          }}
                        />
                      </label>
                    ),
                  )}
                </div>
                <button className="button" onClick={saveLocation}>
                  Set location & load environmental data
                </button>
                <p>Find decimal coordinates from your site map; use an IANA timezone such as Asia/Kolkata. These fields do not measure tank storage.</p>
                <p role="status">{envStatus}</p>
              </Panel>
              <Panel className="analysis-panel">
                <Eyebrow>02 · LOCAL OPERATIONS</Eyebrow>
                <h2>Enter readings or import daily records</h2>
                <p>
                  Use liters and daily totals. Enter demand excluding any
                  additional loss entered separately. Zero loss must be
                  explicitly entered; anomaly flags alone do not add water
                  losses.
                </p>
                <div className="analysis-fields">
                  {fields
                    .slice(0, 6)
                    .filter(
                      ([k]) => k !== "demand" || demandMethod === "entered",
                    )
                    .map(([key, label]) => (
                      <label className="system-field" key={key}>
                        {label}
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={draft[key]}
                          onChange={(e) => change(key, e.target.value)}
                        />
                      </label>
                    ))}
                  <label className="system-field">
                    Reading timestamp (ISO 8601 with timezone)
                    <input
                      value={draft.reading}
                      placeholder="YYYY-MM-DDTHH:mm:ss+05:30"
                      onChange={(e) => change("reading", e.target.value)}
                    />
                  </label>
                  <label className="system-field">
                    Demand source
                    <select
                      value={demandMethod}
                      onChange={(e) => {
                        markDirty();
                        setDemandMethod(e.target.value as typeof demandMethod);
                        setResult(null);
                        setAnalysis(null);
                      }}
                    >
                      <option value="entered">
                        Actual entered daily consumption
                      </option>
                      <option value="history">
                        Median of imported site daily consumption
                      </option>
                    </select>
                  </label>
                </div>
                <p>Use the time your storage reading was taken, including its timezone offset. Capacity is the tank’s maximum volume; supply and consumption are daily totals, not cumulative meter readings.</p>
                <details className="analysis-import">
                  <summary>Import operational CSV (accepted records saved on explicit cloud save)</summary>
                  <p>
                    Schema:
                    timestamp,storage_liters,supply_liters,consumption_liters,zone.
                    Timestamp and at least one liters column required. Use
                    zone=site for whole-site daily totals; zone totals are not
                    automatically summed. Consumption/supply represent the
                    preceding daily interval. Maximum 500 rows / 500 KB.
                  </p>
                  <p><a href="/templates/operational-records.csv" download>Download blank CSV template ↓</a> · No example readings are included. Fill it only with permissioned site records.</p>
                  <label>
                    CSV file
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 500000) {
                          setError("CSV limit is 500 KB.");
                          return;
                        }
                        const text = await f.text();
                        setCsv(text);
                        importRecords(text);
                      }}
                    />
                  </label>
                  <label>
                    Paste CSV
                    <textarea
                      value={csv}
                      onChange={(e) => setCsv(e.target.value)}
                      rows={6}
                    />
                  </label>
                  <button
                    className="button secondary"
                    onClick={() => importRecords()}
                  >
                    Validate & import records
                  </button>
                  {summary && (
                    <div role="status">
                      <p>
                        {summary.accepted} accepted · {summary.rejected}{" "}
                        rejected ·{" "}
                        {summary.reordered
                          ? "Sorted chronologically"
                          : "Chronological order retained"}
                      </p>
                      <p>
                        Date range: {summary.dateRange?.join(" → ") ?? "None"}
                        <br />
                        Zones: {summary.zones.join(", ") || "None"}
                        <br />
                        Missing fields:{" "}
                        {summary.missingFields.join(", ") || "None"}
                      </p>
                      {summary.errors.slice(0, 10).map((e) => (
                        <p key={e}>{e}</p>
                      ))}
                      <p>
                        Accepted records only are used. Rejected rows are
                        excluded; review gaps before deriving demand.
                      </p>
                    </div>
                  )}
                </details>
              </Panel>
              <Panel className="analysis-panel">
                <Eyebrow>03 · EXPLICIT RESERVE POLICY</Eyebrow>
                <h2>Protect essential demand</h2>
                <p>
                  Critical reserve = daily demand × essential fraction × reserve
                  hours / 24, or your specified volume. Warning reserve uses the
                  same fraction and warning hours, at least the critical volume.
                  Choose every policy value explicitly.
                </p>
                <label className="system-field">
                  Reserve method
                  <select
                    value={reserveKind}
                    onChange={(e) => {
                      markDirty();
                      setReserveKind(e.target.value as typeof reserveKind);
                      setResult(null);
                      setAnalysis(null);
                    }}
                  >
                    <option value="essential-hours">
                      Essential demand × hours
                    </option>
                    <option value="volume">
                      Explicit essential reserve volume
                    </option>
                  </select>
                </label>
                <div className="analysis-fields">
                  {fields
                    .slice(6)
                    .filter(([k]) => k !== "volume" || reserveKind === "volume")
                    .map(([key, label]) => (
                      <label className="system-field" key={key}>
                        {label}
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={draft[key]}
                          onChange={(e) => change(key, e.target.value)}
                        />
                      </label>
                    ))}
                </div>
                <button className="button" onClick={run}>
                  Run Water Security Analysis
                </button>
                <p>
                  Missing required inputs stop calculation. Saved cloud inputs
                  reload after private access is unlocked; unsaved edits remain
                  session-only.
                </p>
              </Panel>
            </>
          )}
          {tab !== "Setup" && tab !== "Data & provenance" && !result && (
            <Panel className="analysis-panel">
              <h2>User input required</h2>
              <p>
                Provide location, capacity, current storage, reading timestamp,
                supply, daily consumption (entered or derived), an explicit
                additional-loss value and reserve policy. No result is
                calculated until these validate.
              </p>
              <button className="button" onClick={() => setTab("Setup")}>
                Complete setup
              </button>
            </Panel>
          )}
          {tab === "Results" && result && (
            <>
              <Panel className="analysis-panel">
                <Eyebrow>CALCULATED · {result.index.modelVersion}</Eyebrow>
                <div className="analysis-metrics">
                  <div>
                    <p>WATER SECURITY INDEX</p>
                    <strong>{result.index.score} / 100</strong>
                    <p>{result.index.classification}</p>
                  </div>
                  <div>
                    <p>NET DAILY DEFICIT</p>
                    <strong>
                      {litres(result.baseline.netDailyDeficitLitres)} / day
                    </strong>
                  </div>
                  <div>
                    <p>CRITICAL RESERVE</p>
                    <strong>
                      {litres(result.input.criticalReserveLitres)}
                    </strong>
                    <p>
                      Critical: {time(result.baseline.criticalCrossing?.timeMs)}
                    </p>
                  </div>
                </div>
                <p>{result.index.disclaimer}</p>
                <p>
                  Demand: {litres(result.input.dailyDemandLitres)}/day ·{" "}
                  {result.demand.provenance.category} ·{" "}
                  {result.demand.provenance.method ??
                    "Actual entered consumption"}
                </p>
              </Panel>
              <Panel className="analysis-panel">
                <h2>Data completeness</h2>
                <p>
                  Operational data: COMPLETE ·{" "}
                  {analysis?.population
                    ? "Occupancy provided"
                    : "Occupancy not provided (context only)"}
                </p>
                <p>
                  Environmental variables:{" "}
                  {environment?.weather.data?.indicators.filter(
                    (i) => i.status === "available",
                  ).length ?? 0}{" "}
                  / 7 available · Historical comparison:{" "}
                  {environment?.history.status ?? "Unavailable"} · Groundwater:{" "}
                  {groundwater ? "Imported regional record" : "UNAVAILABLE"}
                </p>
                <p>
                  Index components: {result.index.dataCompleteness.available} /{" "}
                  {result.index.dataCompleteness.total} · Overall analysis
                  quality:{" "}
                  {environment?.weather.status === "available" &&
                  environment?.history.status === "available"
                    ? "Operationally complete; regional context available"
                    : "Operationally complete; environmental context limited"}
                  . No numeric confidence is claimed.
                </p>
                <div className="system-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Component</th>
                        <th>Score</th>
                        <th>Weight</th>
                        <th>Contribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.index.components.map((c) => (
                        <tr key={c.key}>
                          <th>
                            {c.key}
                            <small>{c.reason}</small>
                          </th>
                          <td>
                            {c.score === null
                              ? "Unavailable"
                              : c.score.toFixed(1)}
                          </td>
                          <td>{c.weight}%</td>
                          <td>
                            {c.contribution === null
                              ? "Excluded"
                              : c.contribution.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  Available weights are renormalized. Groundwater and soil
                  moisture remain contextual: no unsupported universal risk
                  thresholds.
                </p>
              </Panel>
              <Panel className="analysis-panel">
                <h2>Usage anomalies</h2>
                <p>
                  Median + MAD flags possible excess demand. Flags do not
                  confirm leaks or automatically add to total consumption.
                </p>
                {result.anomalies.length ? (
                  result.anomalies.map((a) => (
                    <article key={a.zone}>
                      <h3>
                        {a.zone} · {a.status}
                      </h3>
                      {"expected" in a && (
                        <p>
                          Expected {litres(a.expected!)} / day · Latest{" "}
                          {litres(a.observed!)} / day · Deviation{" "}
                          {a.deviationPercent == null
                            ? "Undefined at zero baseline"
                            : a.deviationPercent.toFixed(1) + "%"}{" "}
                          · {a.count} prior daily records
                        </p>
                      )}
                      <p>{a.reason}</p>
                    </article>
                  ))
                ) : (
                  <p>
                    INSUFFICIENT HISTORY · No zone records imported. No
                    synthetic zones are created.
                  </p>
                )}
              </Panel>
            </>
          )}
          {(tab === "Forecast" || tab === "Simulator") &&
            result &&
            scenario && (
              <Panel className="analysis-panel">
                <Eyebrow>MODEL_OUTPUT · {forecastBoundary}</Eyebrow>
                <h2>
                  {tab === "Forecast"
                    ? "Operational storage forecast"
                    : "Scenario from your baseline"}
                </h2>
                <p>
                  Start: {time(result.input.startTimeMs)}. Constant operational
                  rates; rainfall remains contextual. Reserves are your explicit
                  policy.
                </p>
                {tab === "Simulator" && (
                  <div className="analysis-fields">
                    <label>
                      Demand reduction (%)
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={controls.reductionPercent}
                        onChange={(e) =>
                          setControls({
                            ...controls,
                            reductionPercent: Math.max(
                              0,
                              Math.min(30, Number(e.target.value)),
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      One-time supplementary water (L)
                      <input
                        type="number"
                        min="0"
                        max="25000"
                        value={controls.supplementaryLitres}
                        onChange={(e) =>
                          setControls({
                            ...controls,
                            supplementaryLitres: Math.max(
                              0,
                              Math.min(25000, Number(e.target.value)),
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Initial supply delay (days)
                      <input
                        type="number"
                        min="0"
                        max="3"
                        step="1"
                        value={controls.supplyDelayDays}
                        onChange={(e) =>
                          setControls({
                            ...controls,
                            supplyDelayDays: Math.max(
                              0,
                              Math.min(3, Math.round(Number(e.target.value))),
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={controls.repairAnomaly}
                        onChange={(e) =>
                          setControls({
                            ...controls,
                            repairAnomaly: e.target.checked,
                          })
                        }
                      />{" "}
                      Remove explicitly entered additional loss (hypothesis
                      only)
                    </label>
                  </div>
                )}
                {tab === "Simulator" && analysis && <DecisionBrief context={{ mode: "REAL_ANALYSIS", analysis }} controls={controls} />}
                <StorageChart
                  baseline={result.baseline}
                  intervention={
                    tab === "Simulator"
                      ? scenario.intervention
                      : result.baseline
                  }
                  capacity={result.input.capacityLitres}
                  reserves={{
                    warning: result.input.warningReserveLitres,
                    critical: result.input.criticalReserveLitres,
                  }}
                  basisLabel="REAL ANALYSIS · MODEL_OUTPUT"
                  comparisonLabel={
                    tab === "Simulator" ? "Your scenario" : "Same baseline"
                  }
                  startLabel="Reading time"
                />
                <div className="analysis-metrics">
                  <div>
                    <p>CRITICAL DATE</p>
                    <strong>
                      {time(
                        (tab === "Simulator"
                          ? scenario.intervention
                          : result.baseline
                        ).criticalCrossing?.timeMs,
                      )}
                    </strong>
                  </div>
                  <div>
                    <p>RESILIENCE GAINED</p>
                    <strong>
                      {tab === "Simulator"
                        ? (scenario.resilienceHours?.toFixed(1) ??
                          (scenario.resilienceLowerBoundHours != null
                            ? "At least " +
                              scenario.resilienceLowerBoundHours.toFixed(1)
                            : "Not applicable"))
                        : "0"}{" "}
                      hours
                    </strong>
                  </div>
                  <div>
                    <p>WATER PRESERVED AT BASELINE CRITICAL TIME</p>
                    <strong>
                      {tab === "Forecast"
                        ? result.baseline.criticalCrossing
                          ? "0 L"
                          : "Not applicable"
                        : scenario.waterPreservedLitres == null
                          ? "Not applicable"
                          : litres(scenario.waterPreservedLitres)}
                    </strong>
                  </div>
                  <div>
                    <p>DAILY DEFICIT</p>
                    <strong>
                      {litres(
                        (tab === "Simulator"
                          ? scenario.intervention
                          : result.baseline
                        ).netDailyDeficitLitres,
                      )}{" "}
                      / day
                    </strong>
                  </div>
                </div>
                <details className="analysis-import">
                  <summary>Daily forecast values (MODEL_OUTPUT)</summary>
                  <div className="system-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Day / valid time</th>
                          <th>Baseline storage</th>
                          <th>
                            {tab === "Simulator"
                              ? "Scenario storage"
                              : "Baseline comparison"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.baseline.points.map((p, i) => (
                          <tr key={p.day}>
                            <th>
                              Day {p.day}
                              <small>{time(p.timeMs)}</small>
                            </th>
                            <td>{litres(p.storageLitres)}</td>
                            <td>
                              {litres(
                                tab === "Simulator"
                                  ? scenario.intervention.points[i]
                                      .storageLitres
                                  : p.storageLitres,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
                <p>
                  Preserved volume and resilience compare matching 30-day
                  trajectories. No crossing is not a claim of indefinite safety.
                  Supplementary water is clamped to capacity; initial supply
                  delays receive no make-up deliveries.
                </p>
              </Panel>
            )}
          {tab === "Data & provenance" && (
            <>
              <Panel className="analysis-panel">
                <h2>Regional environmental context</h2>
                <p>
                  {envStatus} · Location: {location?.name ?? "Required"}
                </p>
                {location && (
                  <button
                    className="button secondary"
                    onClick={() => void loadEnvironment(location)}
                  >
                    Refresh environmental context
                  </button>
                )}
                {environment?.weather.issue && (
                  <p>{environment.weather.issue}</p>
                )}
                {environment?.weather.data && (
                  <>
                    <p>
                      {environment.weather.data.source} ·{" "}
                      {environment.weather.data.model}
                      <br />
                      Requested: {location?.latitude}, {location?.longitude} ·
                      Grid: {environment.weather.data.grid.latitude},{" "}
                      {environment.weather.data.grid.longitude}
                      <br />
                      {environment.weather.data.spatialContext}
                      <br />
                      Retrieved: {environment.weather.data.retrievedAt} · Valid:{" "}
                      {environment.weather.data.validTime} ·{" "}
                      {environment.weather.status === "cached"
                        ? "STALE CACHE"
                        : environment.weather.data.freshness.toUpperCase()}
                    </p>
                    <div className="system-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Variable</th>
                            <th>Value / units</th>
                            <th>Provenance / window</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ...environment.weather.data.indicators,
                            environment.weather.data.forecastPrecipitation,
                          ].map((i, n) => (
                            <tr key={i.name + n}>
                              <th>
                                {n === 7 ? "Forecast precipitation" : i.name}
                              </th>
                              <td>
                                {i.value
                                  ? i.value.value.toFixed(3) + " " + i.unit
                                  : "Unavailable"}
                              </td>
                              <td>
                                {i.value?.provenance.category ?? "No value"}
                                <br />
                                {i.windowStart} → {i.windowEnd}
                                <br />
                                {i.reason}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p>
                      Potential evapotranspiration: Unavailable.{" "}
                      {
                        environment.weather.data.potentialEvapotranspiration
                          .reason
                      }
                    </p>
                    <p>
                      Data via{" "}
                      <a href="https://open-meteo.com/en/docs/ecmwf-api">
                        Open-Meteo ECMWF API
                      </a>
                      , CC BY 4.0. Public noncommercial API limits apply.
                    </p>
                  </>
                )}
                {!environment?.weather.data && (
                  <p>Unavailable. No environmental demo values are supplied.</p>
                )}
              </Panel>
              <Panel className="analysis-panel">
                <h2>Historical baseline context</h2>
                <p>
                  {environment?.history.status ?? "Unavailable"} ·{" "}
                  {environment?.history.issue}
                </p>
                {environment?.history.data && (
                  <>
                    <p>
                      {environment.history.data.source} ·{" "}
                      {environment.history.data.model}
                      <br />
                      {environment.history.data.spatialContext}
                      <br />
                      Retrieved: {environment.history.data.retrievedAt} · Last
                      available day: {environment.history.data.validTime}
                    </p>
                    <p>
                      Recent delayed window:{" "}
                      {environment.history.data.window.join(" → ")}
                      <br />
                      Rainfall:{" "}
                      {environment.history.data.recentPrecipitation.value.toFixed(
                        1,
                      )}{" "}
                      mm · Prior 3-year same-window mean:{" "}
                      {environment.history.data.historicalMean.value.toFixed(1)}{" "}
                      mm
                      <br />
                      Rainfall ratio:{" "}
                      {environment.history.data.ratio?.value.toFixed(2) ??
                        "Unavailable (zero historical mean)"}
                      <br />
                      Temperature:{" "}
                      {environment.history.data.recentTemperature.value.toFixed(
                        1,
                      )}{" "}
                      °C vs{" "}
                      {environment.history.data.historicalTemperature.value.toFixed(
                        1,
                      )}{" "}
                      °C
                    </p>
                    <p>{environment.history.data.description}</p>
                  </>
                )}
              </Panel>
              <Panel className="analysis-panel">
                <h2>Groundwater · regional context</h2>
                <p>
                  {groundwater ? "IMPORTED_RECORD" : "UNAVAILABLE"} · No
                  reliable automated groundwater feed integrated. A
                  CGWB/India-WRIS record may be imported with its authoritative
                  URL; its transcription is not independently verified.
                </p>
                <details>
                  <summary>Import authoritative groundwater JSON</summary>
                  <p>
                    Fields: region, location (name,latitude,longitude,timezone),
                    depthBelowGroundMetres, validTime (ISO timezone), sourceURL
                    (CGWB/India-WRIS HTTPS).
                  </p>
                  <label>
                    Groundwater JSON
                    <textarea
                      rows={4}
                      value={gwText}
                      onChange={(e) => setGwText(e.target.value)}
                    />
                  </label>
                  <button
                    className="button secondary"
                    onClick={() => {
                      try {
                        if (gwText.length > 10000)
                          throw new RangeError(
                            "Groundwater import limit 10 KB",
                          );
                        setGroundwater(importGroundwater(JSON.parse(gwText)));
                        setError("");
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Validate groundwater record
                  </button>
                </details>
                {groundwater && (
                  <p>
                    {groundwater.region}:{" "}
                    {groundwater.depthBelowGroundMetres.value} m below ground ·{" "}
                    {groundwater.depthBelowGroundMetres.provenance.timestamp}
                    <br />
                    {groundwater.sourceURL}
                    <br />
                    {groundwater.limitations}
                  </p>
                )}
              </Panel>
              <Panel className="analysis-panel">
                <h2>Operational provenance</h2>
                {analysis ? (
                  <>
                    <p>
                      REAL_ANALYSIS · {analysis.records.length} imported records
                      · Reading {analysis.readingTimestamp}
                    </p>
                    <div className="system-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Input</th>
                            <th>Value</th>
                            <th>Source / timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(
                            [
                              "capacity",
                              "storage",
                              "supply",
                              "population",
                              "demand",
                              "additionalLoss",
                              "reserve",
                            ] as const
                          ).map((key) => {
                            const v =
                              key === "demand" ? result?.demand : analysis[key];
                            return (
                              <tr key={key}>
                                <th>{key}</th>
                                <td>
                                  {v
                                    ? typeof v.value === "number"
                                      ? v.value
                                      : analysis.reserve.value.kind === "volume"
                                        ? `${analysis.reserve.value.volumeLitres} L essential reserve`
                                        : `${analysis.reserve.value.essentialFraction * 100}% essential demand × ${analysis.reserve.value.essentialReserveHours} hours`
                                    : "Not provided"}
                                </td>
                                <td>
                                  {v?.provenance.category}
                                  <br />
                                  {v?.provenance.source}
                                  <br />
                                  {v?.provenance.timestamp}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p>
                    User input required; no seeded operational values loaded.
                  </p>
                )}
                <p>
                  Forecast: MODEL_OUTPUT. Water balance, reserve volume, index
                  and statistical deviations: CALCULATED. Regional API
                  ingestion: LIVE_API; it remains model data. Historical
                  reanalysis: PUBLIC_DATASET. Imported history: IMPORTED_RECORD.
                  Sample Demo: DEMO_SYNTHETIC.
                </p>
              </Panel>
            </>
          )}
          </fieldset>
<details className="analysis-cloud" id="cloud-access">
<summary>Optional: protected cloud save / load</summary>
          <Panel className="analysis-panel">
            <Eyebrow>PRIVATE CLOUD PERSISTENCE · REAL ANALYSIS ONLY</Eyebrow>
            <h2>Your saved analysis</h2>
            <p role="status" aria-live="polite">{cloudStatus.toUpperCase()} · {cloudMessage || "Checking private cloud access…"}</p>
            {!unlocked && (
              <div className="analysis-fields">
                <label className="system-field">Operator access code
                  <input type="password" autoComplete="off" value={accessCode} disabled={cloudBusy} onChange={e => setAccessCode(e.target.value)} />
                </label>
                <button className="button secondary" disabled={cloudBusy || !accessCode} onClick={() => void unlockCloud()}>Unlock private cloud</button>
              </div>
            )}
            <div className="analysis-tabs">
              <button className="button" disabled={cloudBusy || !unlocked || !analysis || knownVersion === null || needsReload || cloudStatus === "saved"} onClick={() => void saveCloud()}>Save Real Analysis to AWS</button>
              <button className="button secondary" disabled={cloudBusy || !unlocked} onClick={() => void reloadCloud()}>Reload cloud state (replace local edits)</button>
              {unlocked && <button className="button secondary" disabled={cloudBusy} onClick={() => void lockCloud()}>Lock cloud access</button>}
            </div>
            <p>Save uploads your validated operational inputs and accepted CSV records to the private single-site AWS record. Local drafts and unsaved edits are not persisted. Sample Demo is stored separately.</p>
            {campus && <p>Schema {campus.schemaVersion} · revision {campus.version} · {campus.updatedAt}<br />Forecast: {campus.modelMetadata.forecast} · Index: {campus.modelMetadata.indexVersion} · {campus.environmentalProvenance.length} saved environmental source entries</p>}
            {campus && <details className="analysis-import"><summary>Saved environmental provenance</summary>
              {campus.environmentalProvenance.length ? <div className="system-table"><table><thead><tr><th>Variable / source</th><th>Valid time / retrieval</th><th>Model / geographic context</th></tr></thead><tbody>
                {campus.environmentalProvenance.map((p, i) => <tr key={`${p.variable}-${i}`}><th>{p.variable}<small>{p.category} · {p.source}</small></th><td>{p.timestamp}<br />{p.retrievedAt}</td><td>{p.model}<br />{p.coordinates.latitude}, {p.coordinates.longitude}<small>{p.context}</small></td></tr>)}
              </tbody></table></div> : <p>No environmental source metadata was available at save time. Operational inputs were saved without a substitute.</p>}
            </details>}
          </Panel>
</details>

        </main>
        <footer className="dashboard-footer">
          REAL ANALYSIS · {cloudStatus.toUpperCase()} · Rainfall is
          contextual
        </footer>
      </div>
    </div>
  );
}
