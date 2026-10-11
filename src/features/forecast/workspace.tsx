"use client";
import { useState } from "react";
import { formatLitres } from "@/lib/demo-data";
import { Eyebrow } from "@/components/ui";
import { forecastStorage, recommendedIntervention } from "./model";
import { forecastPolicy, forecastHorizons } from "./policy";
import { formatForecastTime } from "./demo-forecast";
import { useOperations } from "@/features/system/context";
import { clipForecast } from "@/lib/api-client";
import { StorageChart } from "./chart";
export function ForecastWorkspace() {
  const {
    view: demo,
    input: baseInput,
    comparison: demoComparison,
    modeLabel,
    provenance,
    remoteForecast,
    forecastBoundary,
    forecastNotice,
  } = useOperations();
  const [horizon, setHorizon] = useState<number>(
    forecastPolicy.defaultHorizonDays,
  );
  const input = { ...baseInput, horizonDays: horizon },
    baseline = remoteForecast
      ? clipForecast(remoteForecast.comparison.baseline, horizon)
      : forecastStorage(input),
    intervention = remoteForecast
      ? clipForecast(remoteForecast.comparison.intervention, horizon)
      : forecastStorage(recommendedIntervention(input, demo.reductionPercent));
  return (
    <div className="forecast-workspace">
      <div className="overview-heading">
        <div>
          <Eyebrow>FORECAST</Eyebrow>
          <h1>
            Water storage outlook<span>.</span>
          </h1>
          <p>Understand the reserve window. See what action changes.</p>
        </div>
        <span className="preview-label">{modeLabel}</span>
      </div>
      <section
        className="forecast-result"
        aria-label="Baseline forecast result"
      >
        <div>
          <Eyebrow>CRITICAL RESERVE EXPECTED IN</Eyebrow>
          <div className="prediction-number">
            {baseline.criticalCrossing?.day.toFixed(1) ?? "—"}
            <span>DAYS</span>
          </div>
          <p className="demo-reference">Days from the sample reading: {formatForecastTime(input.startTimeMs)}. Synthetic example, not a countdown from today.</p>
          <p className="prediction-time">
            {baseline.criticalCrossing
              ? formatForecastTime(baseline.criticalCrossing.timeMs)
              : `Not reached within ${horizon}-day chart`}
          </p>
        </div>
        <div className="model-basis">
          <Eyebrow>MODEL BASIS</Eyebrow>
          <p>
            {forecastBoundary} ·{" "}
            {forecastNotice || "Same tested operational engine in both modes."}
          </p>
          <h2>Deterministic operational forecast</h2>
          <p>
            Constant daily water balance. No statistical confidence or machine
            learning.
          </p>
          <p>
            Warning reserve reached in{" "}
            <strong>
              {baseline.warningCrossing?.day.toFixed(1) ?? "—"} days
            </strong>
            <br />
            {baseline.warningCrossing
              ? formatForecastTime(baseline.warningCrossing.timeMs)
              : `Not reached within ${horizon}-day chart`}
          </p>
        </div>
      </section>
      <section
        className="forecast-visualization"
        aria-labelledby="trajectory-title"
      >
        <div className="forecast-chart-heading">
          <div>
            <Eyebrow>BASELINE → RECOMMENDED INTERVENTION</Eyebrow>
            <h2 id="trajectory-title">Two paths for the same storage.</h2>
          </div>
          <fieldset className="horizon-control">
            <legend>Forecast horizon</legend>
            {forecastHorizons.map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={horizon === days}
                onClick={() => setHorizon(days)}
              >
                {days} days
              </button>
            ))}
          </fieldset>
        </div>
        <p className="horizon-description" aria-live="polite">
          Showing {horizon} days from {formatForecastTime(input.startTimeMs)}.
        </p>
        <StorageChart
          baseline={baseline}
          intervention={intervention}
          capacity={input.capacityLitres}
          basisLabel={modeLabel + " · CONSTANT RATES"}
        />
        <div className="forecast-balance">
          <span>
            Baseline deficit{" "}
            <strong>{formatLitres(baseline.netDailyDeficitLitres)}/day</strong>
          </span>
          <span>
            With intervention{" "}
            <strong>
              {formatLitres(intervention.netDailyDeficitLitres)}/day
            </strong>
          </span>
          <span>
            Minimum storage (baseline / intervention){" "}
            <strong>
              {formatLitres(baseline.minimumStorageLitres)} /{" "}
              {formatLitres(intervention.minimumStorageLitres)}
            </strong>
          </span>
        </div>
        <details className="forecast-table">
          <summary>View daily storage values</summary>
          <table>
            <caption>
              Daily modeled storage in litres · {horizon}-day horizon
            </caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Baseline</th>
                <th scope="col">Intervention</th>
              </tr>
            </thead>
            <tbody>
              {baseline.points.map((point, i) => (
                <tr key={point.day}>
                  <th scope="row">{point.day}</th>
                  <td>{formatLitres(point.storageLitres)}</td>
                  <td>{formatLitres(intervention.points[i].storageLitres)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
      <section
        className="forecast-comparison"
        aria-label="Calculated intervention comparison"
      >
        <div className="comparison-heading">
          <Eyebrow>
            REPAIR ANOMALY + REDUCE DEMAND BY {demo.reductionPercent}%
          </Eyebrow>
          <p>
            Immediate, sustained intervention · Dates evaluated over{" "}
            {forecastPolicy.comparisonHorizonDays} days
          </p>
        </div>
        <div className="comparison-values">
          <div>
            <Eyebrow>BASELINE CRITICAL DATE</Eyebrow>
            <h2>
              {formatForecastTime(
                demoComparison.baseline.criticalCrossing?.timeMs,
              )}
            </h2>
            <p>
              {demoComparison.baseline.criticalCrossing?.day.toFixed(1) ?? "—"}{" "}
              days from demo start
            </p>
          </div>
          <div>
            <Eyebrow>INTERVENTION CRITICAL DATE</Eyebrow>
            <h2>
              {formatForecastTime(
                demoComparison.intervention.criticalCrossing?.timeMs,
              )}
            </h2>
            <p>
              {demoComparison.intervention.criticalCrossing?.day.toFixed(2) ??
                "—"}{" "}
              days from demo start
              {demoComparison.intervention.criticalCrossing &&
              demoComparison.intervention.criticalCrossing.day > horizon
                ? ` · Beyond the ${horizon}-day chart`
                : ""}
            </p>
          </div>
          <div>
            <Eyebrow>RESILIENCE GAINED</Eyebrow>
            <div className="comparison-number">
              {demoComparison.resilienceHours == null
                ? "—"
                : "+" + demoComparison.resilienceHours.toFixed(1)}
              <span>HOURS</span>
            </div>
          </div>
          <div>
            <Eyebrow>WATER PRESERVED</Eyebrow>
            <div className="comparison-number">
              {demoComparison.waterPreservedLitres == null
                ? "Not evaluated"
                : formatLitres(demoComparison.waterPreservedLitres)}
            </div>
            <p>
              {demoComparison.comparisonDay == null
                ? "Not evaluated without a baseline critical crossing"
                : `Additional stored water at baseline critical time (day ${demoComparison.comparisonDay.toFixed(1)})`}
            </p>
          </div>
        </div>
      </section>
      <section
        className="forecast-assumptions"
        aria-labelledby="assumptions-title"
      >
        <div>
          <Eyebrow>TRANSPARENT BY DESIGN</Eyebrow>
          <h2 id="assumptions-title">What this forecast assumes.</h2>
          <p className="reserve-explanation">
            Critical reserve is the minimum operational storage level JalDrishti
            treats as unsafe to cross. It is not the same as an empty tank.
          </p>
        </div>
        <dl>
          {[
            {
              label: "Starting storage",
              value: formatLitres(input.startingStorageLitres),
            },
            {
              label: "Daily demand",
              value: formatLitres(input.dailyDemandLitres),
            },
            {
              label: "Daily supply",
              value: formatLitres(input.dailySupplyLitres),
            },
            {
              label: "Additional anomaly loss",
              value: formatLitres(input.dailyAnomalyLossLitres) + "/day",
            },
            {
              label: "Warning reserve",
              value: formatLitres(input.warningReserveLitres),
            },
            {
              label: "Critical reserve",
              value: formatLitres(input.criticalReserveLitres),
            },
            {
              label: "Tank capacity",
              value: formatLitres(input.capacityLitres),
            },
            { label: "Forecast horizon", value: horizon + " days" },
          ].map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
              <small>
                {item.label === "Forecast horizon"
                  ? "USER SELECTED"
                  : item.label === "Starting storage"
                    ? provenance("currentStorage")
                    : item.label === "Daily demand"
                      ? provenance("dailyDemand")
                      : item.label === "Daily supply"
                        ? provenance("expectedDailySupply")
                        : item.label === "Tank capacity"
                          ? provenance("storageCapacity")
                          : "SEEDED DEMO"}
              </small>
            </div>
          ))}
        </dl>
        <div className="forecast-method">
          <h3>Daily water balance</h3>
          <code>storage + supply − demand − anomaly loss</code>
          <p>
            Critical reserve remains the fixed 2,236 L policy calibrated to the
            original seed. Warning reserve remains 10,000 L; it does not scale
            when capacity is edited. Neither threshold is a validated safety
            standard.
          </p>
          <ul>
            {baseline.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
            <li>
              Rainfall, soil moisture and groundwater are contextual demo
              signals; they do not change this forecast.
            </li>
            <li>
              Reference time is fixed at 7 October 2026, 2:00 PM IST. “Today”
              denotes this demo start, not a live clock.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
