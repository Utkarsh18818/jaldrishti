import { Eyebrow } from "@/components/ui";
import { formatForecastTime } from "@/features/forecast/demo-forecast";
import { formatLitres } from "@/lib/demo-data";
import type { evaluateScenario } from "./adapter";
type Evaluation = ReturnType<typeof evaluateScenario>;
const signed = (value: number, digits: number = 1) =>
  (value > 0 ? "+" : value < 0 ? "−" : "") + Math.abs(value).toFixed(digits);
export function ScenarioResults({
  result,
  revision,
}: {
  result: Evaluation;
  revision: string;
}) {
  const crossing = result.intervention.criticalCrossing;
  return (
    <section className="scenario-results" aria-label="Scenario result">
      <div className="scenario-critical">
        <Eyebrow>SCENARIO RESULT · CRITICAL RESERVE</Eyebrow>
        <div className="scenario-result-value" key={revision}>
          {crossing ? (
            <>
              <strong>{crossing.day.toFixed(1)}</strong>
              <span>DAYS</span>
            </>
          ) : (
            <strong className="scenario-no-crossing">
              Beyond {result.intervention.horizonDays} days
            </strong>
          )}
        </div>
        <h2>{formatForecastTime(crossing?.timeMs)}</h2>
        <p>
          MODEL OUTPUT · Current operational baseline and your scenario
          assumptions.
        </p>
      </div>
      <div className="scenario-impact" key={"impact-" + revision}>
        <div>
          <Eyebrow>
            {result.resilienceHours != null && result.resilienceHours < 0
              ? "RESILIENCE LOST"
              : "RESILIENCE GAINED"}
          </Eyebrow>
          <div className="scenario-impact-number">
            {result.resilienceHours != null
              ? signed(result.resilienceHours)
              : result.resilienceLowerBoundHours != null
                ? "≥" + result.resilienceLowerBoundHours.toFixed(1)
                : "—"}
            <span>HOURS</span>
            <small className="scenario-days">
              {result.resilienceDays != null
                ? signed(result.resilienceDays, 2)
                : result.resilienceLowerBoundDays != null
                  ? "≥" + result.resilienceLowerBoundDays.toFixed(1)
                  : "—"}{" "}
              days relative to baseline
            </small>
          </div>
          <p>
            {result.resilienceHours != null
              ? result.resilienceHours < 0
                ? "Earlier reserve crossing"
                : result.resilienceHours === 0
                  ? "No change from baseline"
                  : "Additional water resilience"
              : result.resilienceLowerBoundHours != null
                ? "At least; no scenario crossing within comparison window."
                : "Not evaluated: baseline has no critical crossing within 30 days."}
          </p>
        </div>
        <div>
          <Eyebrow>STORAGE DIFFERENCE</Eyebrow>
          <div className="scenario-impact-number storage-impact">
            {result.waterPreservedLitres != null
              ? (result.waterPreservedLitres < 0 ? "−" : "") +
                formatLitres(Math.abs(Math.round(result.waterPreservedLitres)))
              : "—"}
          </div>
          <p>
            {result.waterPreservedLitres != null &&
            result.waterPreservedLitres < 0
              ? "Less storage"
              : "Additional storage preserved"}{" "}
            {result.comparisonDay == null
              ? "not evaluated without a baseline crossing."
              : `at baseline critical time (day ${result.comparisonDay.toFixed(1)}).`}
          </p>
        </div>
      </div>
      <div className="scenario-date-shift">
        <div>
          <Eyebrow>BASELINE</Eyebrow>
          <h3>
            {formatForecastTime(result.baseline.criticalCrossing?.timeMs)}
          </h3>
          <p>
            Daily deficit{" "}
            <strong>
              {formatLitres(result.baseline.netDailyDeficitLitres)}/day
            </strong>
          </p>
        </div>
        <span className="scenario-versus">VS</span>
        <div>
          <Eyebrow>SCENARIO</Eyebrow>
          <h3>{formatForecastTime(crossing?.timeMs)}</h3>
          <p>
            Daily deficit{" "}
            <strong>
              {formatLitres(result.intervention.netDailyDeficitLitres)}/day
            </strong>
            {result.scenarioInput.supplyDelayDays
              ? " after supply resumes"
              : ""}
          </p>
          {result.scenarioInput.supplyDelayDays ? (
            <small>
              During delay: {formatLitres(result.delayDailyDeficitLitres)}/day
            </small>
          ) : null}
        </div>
      </div>
      <p className="scenario-live-summary" role="status" aria-live="polite">
        Scenario critical reserve: {formatForecastTime(crossing?.timeMs)}.{" "}
        {result.resilienceHours != null
          ? signed(result.resilienceHours) + " hours change"
          : result.resilienceLowerBoundHours != null
            ? "No scenario crossing within the comparison window"
            : "Relative resilience not evaluated without a baseline crossing"}
        . Storage difference:{" "}
        {result.waterPreservedLitres == null
          ? "not evaluated"
          : Math.round(result.waterPreservedLitres) + " litres"}
        .
      </p>
      {result.unretainedSupplementaryLitres > 0 && (
        <p className="scenario-capacity-note">
          Tank capacity limits the top-up to{" "}
          {formatLitres(result.retainedSupplementaryLitres)}.{" "}
          {formatLitres(result.unretainedSupplementaryLitres)} cannot be
          retained.
        </p>
      )}
    </section>
  );
}
