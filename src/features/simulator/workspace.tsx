"use client";
import { useState } from "react";
import { DecisionBrief } from "@/features/decision/panel";
import { useSearchParams } from "next/navigation";
import { useOperations } from "@/features/system/context";
import { Eyebrow } from "@/components/ui";
import { formatLitres } from "@/lib/demo-data";
import { formatForecastTime } from "@/features/forecast/demo-forecast";
import { forecastPolicy, forecastHorizons } from "@/features/forecast/policy";
import { StorageChart } from "@/features/forecast/chart";
import { evaluateScenario, scenarioPresets } from "./adapter";
import type { ScenarioControls } from "./adapter";
import { ScenarioControlPanel } from "./controls";
import { ScenarioResults } from "./results";
export function SimulatorWorkspace() {
  const { input, modeLabel } = useOperations();
  const query = useSearchParams();
  const [controls, setControls] = useState<ScenarioControls>({
    ...scenarioPresets.recommended,
    repairAnomaly:
      query.get("repair") === "on" || scenarioPresets.recommended.repairAnomaly,
  });
  const [horizon, setHorizon] = useState<number>(
    forecastPolicy.defaultHorizonDays,
  );
  const result = evaluateScenario(input, controls, horizon);
  const revision = JSON.stringify([controls, input]);
  const onPreset = (preset: keyof typeof scenarioPresets) =>
    setControls({ ...scenarioPresets[preset] });
  return (
    <div className="simulator-workspace">
      <div className="overview-heading">
        <div>
          <Eyebrow>SCENARIO SIMULATOR</Eyebrow>
          <h1>
            What if we intervene<span>?</span>
          </h1>
          <p>Change the assumptions. See the water outlook respond.</p>
        </div>
        <span className="preview-label">{modeLabel}</span>
      </div>
      <p className="demo-reference">Synthetic example · All days are measured from {formatForecastTime(input.startTimeMs)}, not today.</p>
      <ScenarioResults result={result} revision={revision} />
      <DecisionBrief context={{ mode: "SAMPLE_DEMO", input, siteName: "Pune Sample Demo" }} controls={controls} />
      <p className="scenario-policy-note">
        Critical reserve is a demo operational policy threshold (
        {formatLitres(forecastPolicy.criticalReserveLitres)}). It represents
        minimum emergency storage, not an empty tank.
      </p>
      <div className="simulator-main-grid">
        <ScenarioControlPanel
          controls={controls}
          onChange={(patch) =>
            setControls((previous) => ({ ...previous, ...patch }))
          }
          onPreset={onPreset}
        />
        <section
          className="scenario-chart-panel"
          aria-labelledby="scenario-chart-title"
        >
          <div className="forecast-chart-heading">
            <div>
              <Eyebrow>BASELINE VS SCENARIO</Eyebrow>
              <h2 id="scenario-chart-title">
                One intervention. A different path.
              </h2>
            </div>
            <fieldset className="horizon-control">
              <legend>Chart horizon</legend>
              {forecastHorizons.map((days) => (
                <button
                  type="button"
                  key={days}
                  aria-pressed={horizon === days}
                  onClick={() => setHorizon(days)}
                >
                  {days} days
                </button>
              ))}
            </fieldset>
          </div>
          <p className="horizon-description">
            Fixed demo start: {formatForecastTime(forecastPolicy.startTimeMs)}.
            Results compare first reserve crossings over{" "}
            {forecastPolicy.comparisonHorizonDays} days.
          </p>
          <StorageChart
            baseline={result.baselineChart}
            intervention={result.scenarioChart}
            capacity={input.capacityLitres}
            comparisonLabel="Your scenario"
            basisLabel={modeLabel + " · USER SCENARIO"}
          />
          <details className="forecast-table">
            <summary>View daily comparison values</summary>
            <table>
              <caption>
                Storage in litres · {horizon} days from seeded start
              </caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Baseline</th>
                  <th scope="col">Scenario</th>
                </tr>
              </thead>
              <tbody>
                {result.baselineChart.points.map((point, i) => (
                  <tr key={point.day}>
                    <th scope="row">{point.day}</th>
                    <td>{formatLitres(point.storageLitres)}</td>
                    <td>
                      {formatLitres(
                        result.scenarioChart.points[i].storageLitres,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <div className="scenario-method">
            <Eyebrow>MODEL BASIS</Eyebrow>
            <h3>Deterministic operational forecast</h3>
            <p>
              Demand = base demand × occupancy multiplier × remaining
              consumption. Repair removes anomaly loss. Supplementary water
              arrives once at day zero, before demand. Supply is zero during the
              initial delay; normal supply then resumes without catch-up.
            </p>
            <p>
              Resilience compares first critical-reserve crossings, including an
              early crossing followed by recovery. Water preserved is the
              storage difference at baseline critical time, not cumulative water
              delivered or saved forever.
            </p>
            <p>
              When no crossing occurs within 30 days, resilience is a lower
              bound. Negative differences mean the scenario performs worse. No
              rainfall, weather, cost, repair delay, or live measurements are
              modeled.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
