import {
  scenarioLimits,
  scenarioPresets,
  activeScenarioPreset,
} from "./adapter";
import type { ScenarioControls } from "./adapter";
import { formatLitres } from "@/lib/demo-data";
import { Eyebrow } from "@/components/ui";
type NumericControl = keyof typeof scenarioLimits;
const specs: [NumericControl, string, string][] = [
  [
    "reductionPercent",
    "Consumption reduction",
    "Reduction applies to metered demand, after the occupancy multiplier.",
  ],
  [
    "supplementaryLitres",
    "Supplementary water",
    "One delivery at the demo start, capped by tank capacity.",
  ],
  [
    "supplyDelayDays",
    "Supply delay",
    "No scheduled supply for the first selected days. Normal supply then resumes.",
  ],
  [
    "occupancyPercent",
    "Occupancy / demand multiplier",
    "Scales metered demand; suspected leak loss stays separate.",
  ],
];
export function ScenarioControlPanel({
  controls,
  onChange,
  onPreset,
}: {
  controls: ScenarioControls;
  onChange: (patch: Partial<ScenarioControls>) => void;
  onPreset: (preset: keyof typeof scenarioPresets) => void;
}) {
  const activePreset = activeScenarioPreset(controls);
  return (
    <section
      className="scenario-controls"
      aria-labelledby="scenario-controls-title"
    >
      <Eyebrow>OPERATIONAL ASSUMPTIONS</Eyebrow>
      <h2 id="scenario-controls-title">Shape the intervention.</h2>
      <p className="scenario-preset-status">
        {activePreset === "recommended"
          ? "Recommended intervention applied"
          : activePreset === "baseline"
            ? "Baseline applied"
            : activePreset === "interruption"
              ? "Supply interruption applied"
              : "Custom scenario"}
      </p>
      <div className="scenario-presets" aria-label="Scenario presets">
        <button
          type="button"
          aria-pressed={activePreset === "recommended"}
          onClick={() => onPreset("recommended")}
        >
          Recommended intervention
        </button>
        <button
          type="button"
          aria-pressed={activePreset === "baseline"}
          onClick={() => onPreset("baseline")}
        >
          No intervention
        </button>
        <button
          type="button"
          aria-pressed={activePreset === "interruption"}
          onClick={() => onPreset("interruption")}
        >
          Supply interruption
        </button>
      </div>
      <div className="repair-control">
        <label htmlFor="repair-anomaly">
          <span>
            Repair Block C anomaly<small>Remove suspected daily loss.</small>
          </span>
          <input
            id="repair-anomaly"
            type="checkbox"
            checked={controls.repairAnomaly}
            onChange={(e) => onChange({ repairAnomaly: e.target.checked })}
          />
        </label>
      </div>
      {specs.map(([key, title, note]) => (
        <div className="scenario-range" key={key}>
          <div>
            <label htmlFor={key}>{title}</label>
            <output htmlFor={key}>
              {key === "supplementaryLitres"
                ? formatLitres(controls[key])
                : key === "supplyDelayDays"
                  ? controls[key] + (controls[key] === 1 ? " day" : " days")
                  : controls[key] + "%"}
            </output>
          </div>
          <input
            id={key}
            type="range"
            min={scenarioLimits[key].min}
            max={scenarioLimits[key].max}
            step={scenarioLimits[key].step}
            value={controls[key]}
            onChange={(e) => onChange({ [key]: Number(e.target.value) })}
            aria-describedby={key + "-note"}
          />
          <p id={key + "-note"}>{note}</p>
        </div>
      ))}
      <div className="rainfall-control">
        <label htmlFor="rainfall-scenario">Rainfall / recharge scenario</label>
        <select
          id="rainfall-scenario"
          disabled
          defaultValue="normal"
          aria-describedby="rainfall-note"
        >
          <option value="below">Below Normal</option>
          <option value="normal">Normal</option>
          <option value="above">Above Normal</option>
        </select>
        <p id="rainfall-note">REQUIRES A VERIFIED HARVESTING MODEL</p>
        <small>Disabled. No rainfall impact is modeled.</small>
      </div>
      <div className="scenario-reset">
        <button
          type="button"
          aria-pressed={activePreset === "baseline"}
          onClick={() => onPreset("baseline")}
        >
          Reset to baseline
        </button>
        <button
          type="button"
          aria-pressed={activePreset === "recommended"}
          onClick={() => onPreset("recommended")}
        >
          Apply recommended intervention
        </button>
      </div>
    </section>
  );
}
