"use client";
import Link from "next/link";
import { useState } from "react";
import { Eyebrow, Panel } from "@/components/ui";
import { formatLitres } from "@/lib/demo-data";
import { formatForecastTime } from "@/features/forecast/demo-forecast";
import { useOperations } from "./context";
import { inputFields, provenanceLabels, seedOperations } from "./model";
import type { OperationalValues } from "./model";
const fieldLabels = {
  storageCapacity: "Storage capacity",
  currentStorage: "Current storage",
  population: "Population",
  dailyDemand: "Expected daily demand",
  expectedDailySupply: "Expected daily supply",
};
function originTime(timestamp: string) {
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp)) + " IST"
  );
}
export function SystemWorkspace() {
  const operations = useOperations();
  const {
    state,
    input,
    comparison,
    netDeficit,
    zones,
    zoneTotal,
    anomaly,
    modeLabel,
    provenance,
  } = operations;
  const [draft, setDraft] = useState(
    () =>
      Object.fromEntries(
        inputFields.map((key) => [key, String(state.values[key])]),
      ) as Record<keyof OperationalValues, string>,
  );
  const [appliedValues, setAppliedValues] = useState(state.values);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inspecting, setInspecting] = useState(false);
  if (appliedValues !== state.values) {
    setAppliedValues(state.values);
    setDraft(
      Object.fromEntries(
        inputFields.map((key) => [key, String(state.values[key])]),
      ) as Record<keyof OperationalValues, string>,
    );
    setError("");
  }
  const change =
    netDeficit > 0
      ? "Net daily deficit"
      : netDeficit < 0
        ? "Net daily surplus"
        : "Balanced daily flow";
  async function apply(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (inputFields.some((key) => draft[key].trim() === ""))
        throw new Error("Complete every operational input before applying.");
      const confirmation = await operations.apply(
        Object.fromEntries(
          inputFields.map((key) => [key, Number(draft[key])]),
        ) as OperationalValues,
      );
      setMessage(confirmation);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid inputs.");
    }
  }
  return (
    <>
      <div className="overview-heading">
        <div>
          <Eyebrow>LOCAL OPERATIONAL INTELLIGENCE</Eyebrow>
          <h1>
            System<span>.</span>
          </h1>
          <p>Trace the water balance. Understand each assumption.</p>
        </div>
        <span className="preview-label">{modeLabel}</span>
      </div>
      <p className="system-intro">
        Pune Demo Campus · An illustrative site in the Pune example region
        (18.5204° N, 73.8567° E). No verified campus coordinates or tank
        sensors. Public weather appears separately in{" "}
        <Link href="/dashboard/data">Data</Link>.
      </p>
      <p className="system-intro" role="status">
        {operations.backendMode} · {operations.backendNotice}
        {operations.backendStatus !== "local" && (
          <button
            className="backend-retry"
            disabled={operations.busy}
            onClick={() => void operations.reloadBackend()}
          >
            Reload backend state
          </button>
        )}
      </p>
      <Panel className="system-balance">
        <div className="conditions-heading">
          <h2>Where the water goes</h2>
          <span>DAILY OPERATIONAL BALANCE</span>
        </div>
        <div className="water-flow">
          <div className="flow-supply">
            <Eyebrow>SUPPLY → STORAGE</Eyebrow>
            <strong>
              +{formatLitres(input.dailySupplyLitres)}
              <small>/day</small>
            </strong>
            <span>{provenance("expectedDailySupply")}</span>
          </div>
          <div className="flow-storage">
            <Eyebrow>MAIN STORAGE</Eyebrow>
            <strong>{formatLitres(input.startingStorageLitres)}</strong>
            <p>of {formatLitres(input.capacityLitres)}</p>
            <meter
              min={0}
              max={input.capacityLitres}
              value={input.startingStorageLitres}
              aria-label="Stored water as a fraction of capacity"
            />
            <span>
              Storage: {provenance("currentStorage")} · Capacity:{" "}
              {provenance("storageCapacity")}
            </span>
          </div>
          <div className="flow-outflows">
            <div>
              <Eyebrow>→ DEMAND</Eyebrow>
              <strong>
                −{formatLitres(input.dailyDemandLitres)}
                <small>/day</small>
              </strong>
              <span>{provenance("dailyDemand")}</span>
            </div>
            <div>
              <Eyebrow>→ POTENTIAL ANOMALY LOSS</Eyebrow>
              <strong>
                −{formatLitres(input.dailyAnomalyLossLitres)}
                <small>/day</small>
              </strong>
              <span>SEEDED DEMO ASSUMPTION · NOT CONFIRMED LEAK</span>
            </div>
          </div>
        </div>
        <div className="flow-net">
          <div>
            <Eyebrow>{change}</Eyebrow>
            <strong>
              {netDeficit > 0 ? "−" : netDeficit < 0 ? "+" : ""}
              {formatLitres(Math.abs(netDeficit))}/day
            </strong>
            <span>CALCULATED · Supply − demand − additional anomaly loss</span>
          </div>
          <div>
            <Eyebrow>CRITICAL RESERVE</Eyebrow>
            <strong>{formatLitres(input.criticalReserveLitres)}</strong>
            <span>SEEDED DEMO POLICY · Not a validated safety threshold</span>
          </div>
          <div>
            <Eyebrow>CRITICAL DATE · MODEL OUTPUT</Eyebrow>
            <strong className="system-date">
              {formatForecastTime(comparison.baseline.criticalCrossing?.timeMs)}
            </strong>
            <span>30-day window · Fixed reference 7 Oct 2026, 2 PM IST</span>
          </div>
        </div>
      </Panel>
      <div className="system-grid">
        <Panel className="system-inputs">
          <Eyebrow>LOCAL / DEMO MODE</Eyebrow>
          <h2>Operational inputs</h2>
          <p>
            {operations.backendStatus === "connected"
              ? "Confirmed backend saves load again after reload."
              : "Local changes stay in this dashboard session; reload resets to the seed."}{" "}
            Population is context only; demand is entered independently.
          </p>
          <form onSubmit={apply} noValidate>
            {inputFields.map((key) => (
              <div className="system-field" key={key}>
                <label htmlFor={key}>
                  {fieldLabels[key]}{" "}
                  <span>
                    {key === "population"
                      ? "people"
                      : key === "dailyDemand" || key === "expectedDailySupply"
                        ? "L/day"
                        : "L"}
                  </span>
                </label>
                <input
                  id={key}
                  type="number"
                  disabled={operations.busy}
                  required
                  min={
                    key === "population"
                      ? 1
                      : key === "storageCapacity"
                        ? 10000
                        : 0
                  }
                  step={key === "population" ? 1 : "any"}
                  value={draft[key]}
                  onChange={(event) => {
                    setDraft((previous) => ({
                      ...previous,
                      [key]: event.target.value,
                    }));
                    setMessage("");
                  }}
                  aria-describedby={key + "-origin"}
                />
                <p id={key + "-origin"}>
                  {provenance(key)} · {originTime(state.origins[key].timestamp)}
                </p>
              </div>
            ))}
            <p className="system-note">
              Capacity must support the fixed 10,000 L warning and 2,236 L
              critical reserves. Current storage cannot exceed capacity. Inputs
              must be nonnegative; population must be a positive whole number.
              Enter normal demand excluding the separate seeded 1,620 L/day
              potential loss assumption.
            </p>
            {error && (
              <p className="system-error" role="alert">
                {error}
              </p>
            )}
            <p className="system-success" role="status">
              {message}
            </p>
            <div className="environment-actions">
              <button
                className="button"
                type="submit"
                disabled={operations.busy}
              >
                {operations.busy
                  ? "Working…"
                  : operations.backendStatus === "connected"
                    ? "Save operational inputs"
                    : "Apply local inputs"}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={operations.busy}
                onClick={async () => {
                  try {
                    const confirmation = await operations.reset();
                    const seed = seedOperations().values;
                    setDraft(
                      Object.fromEntries(
                        inputFields.map((key) => [key, String(seed[key])]),
                      ) as Record<keyof OperationalValues, string>,
                    );
                    setError("");
                    setMessage(confirmation);
                  } catch (cause) {
                    setError(
                      cause instanceof Error ? cause.message : "Reset failed.",
                    );
                  }
                }}
              >
                Reset demo
              </button>
            </div>
          </form>
        </Panel>
        <Panel className="system-zones">
          <Eyebrow>MAIN STORAGE → SITE ZONES</Eyebrow>
          <h2>Usage across the site</h2>
          <p>
            Illustrative allocation, not submeter readings. Normal demand totals{" "}
            {formatLitres(input.dailyDemandLitres)}/day; estimated use including
            potential excess totals {formatLitres(zoneTotal)}/day.
          </p>
          <div className="system-table">
            <table>
              <caption>
                Baseline shares scale with entered demand; the seeded Block C
                excess remains an additional loss assumption.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Zone</th>
                  <th scope="col">Estimated use</th>
                  <th scope="col">Baseline</th>
                  <th scope="col">Variance</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.name}>
                    <th scope="row">{zone.name}</th>
                    <td>{formatLitres(zone.estimatedUse)}/day</td>
                    <td>{formatLitres(zone.baseline)}/day</td>
                    <td>
                      {zone.variancePercent === null
                        ? "No baseline"
                        : (zone.variancePercent > 0 ? "+" : "") +
                          zone.variancePercent.toFixed(1) +
                          "%"}
                    </td>
                    <td>{zone.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="system-note">
            {state.origins.dailyDemand.kind === "seeded"
              ? "SEEDED DEMO PROFILE"
              : "CALCULATED FROM USER DEMAND + SEEDED ALLOCATION"}{" "}
            · Observed demo usage is a constructed profile, not a local
            measurement.
          </p>
          <div id="block-c-detail" className="system-anomaly">
            <Eyebrow>{anomaly.provenance}</Eyebrow>
            <h3>Block C · Potential anomaly</h3>
            <dl>
              {[
                {
                  label: "Observed demo usage / modeled use",
                  value: formatLitres(anomaly.estimatedUse) + "/day",
                },
                {
                  label: "Normal baseline",
                  value: formatLitres(anomaly.baseline) + "/day",
                },
                {
                  label: "Variance",
                  value:
                    anomaly.variancePercent === null
                      ? "Undefined with zero demand baseline"
                      : "+" + anomaly.variancePercent.toFixed(1) + "%",
                },
                {
                  label: "Estimated excess volume",
                  value: formatLitres(anomaly.excess) + "/day",
                },
                {
                  label: "Potential loss assumption",
                  value:
                    formatLitres(input.dailyAnomalyLossLitres) +
                    "/day · SEEDED DEMO",
                },
              ].map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
            <p>
              Inspect the Block C supply line and compare metered usage before
              confirming leakage. The model treats this demo excess as
              additional loss outside entered normal demand; legitimate
              consumption could also explain it.
            </p>
            <div className="environment-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setInspecting(true)}
              >
                Investigate
              </button>
              <Link className="button" href="/dashboard/simulator?repair=on">
                Simulate repair
              </Link>
            </div>
            <details
              id="inspection"
              open={inspecting}
              onToggle={(event) => setInspecting(event.currentTarget.open)}
            >
              <summary>Inspection checklist</summary>
              <ul>
                <li>
                  Compare an actual Block C meter reading with a verified
                  baseline.
                </li>
                <li>
                  Check supply-line leaks, fixtures and occupancy changes.
                </li>
                <li>
                  Verify whether demand already includes the excess before using
                  this additional loss assumption.
                </li>
              </ul>
            </details>
          </div>
        </Panel>
      </div>
      <section className="system-audit">
        <Eyebrow>PROVENANCE BOUNDARY</Eyebrow>
        <p>
          {provenanceLabels.user}: explicitly edited local assumptions.{" "}
          {provenanceLabels.seeded}: illustrative fixtures and reserve policy.{" "}
          {provenanceLabels.calculated}: water balance and zone allocations.{" "}
          {provenanceLabels.detected}: a computed excess in the demo profile,
          not sensor detection. {provenanceLabels.output}: the existing
          deterministic engine. External environmental data remains separate and
          never credits tank storage.
        </p>
      </section>
    </>
  );
}
