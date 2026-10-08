"use client";
import { useOperations } from "@/features/system/context";
import Link from "next/link";
import {
  ArrowRight,
  Droplets,
  AlertTriangle,
  CloudRain,
  Sprout,
  ArrowDownRight,
  Waves,
} from "lucide-react";
import {
  environmentalDemo,
  securityScale,
  formatLitres,
} from "@/lib/demo-data";
import { Eyebrow, StatusBadge, ButtonLink } from "@/components/ui";
export function Prediction() {
  const { view: demo } = useOperations();
  return (
    <section className="prediction" aria-label="Critical storage prediction">
      <div className="prediction-top">
        <Eyebrow>01 / PREDICTION</Eyebrow>
        <span className="preview-label">MODEL OUTPUT</span>
      </div>
      <div className="prediction-number">
        {demo.criticalDays}
        <span>DAYS</span>
      </div>
      <h2>Until critical storage</h2>
      <p className="prediction-time">
        {demo.criticalTime.replace(" ~", " · ~")}
      </p>
      <p className="prediction-note">
        {demo.criticalDays === "—"
          ? "No critical reserve crossing within the 30-day comparison window."
          : demo.criticalDays === "0.0"
            ? "Starting storage is already at or below the critical reserve."
            : "A preventive window remains. Act before storage becomes critical."}
      </p>
    </section>
  );
}
export function SecurityState() {
  const { view: demo } = useOperations();
  return (
    <section className="security-state" aria-label="Water security state">
      <Eyebrow>WATER SECURITY</Eyebrow>
      <div className="state-score">
        {demo.score}
        <span>/ 100</span>
      </div>
      <StatusBadge risk={demo.risk}>{demo.status}</StatusBadge>
      <div
        className="context-scale"
        role="img"
        aria-label={`Demo score ${demo.score} of 100: High Stress. Approximate demo ranges: Critical 0–24, High Stress 25–49, Watch 50–74, Stable 75–100.`}
      >
        <div className="scale-pointer" style={{ left: demo.score + "%" }}>
          <span>{demo.score}</span>
          <i />
        </div>
        <div className="scale-segments">
          {securityScale.map((range) => (
            <span key={range.label} className={`scale-${range.risk}`} />
          ))}
        </div>
        <div className="scale-labels">
          {securityScale.map((range) => (
            <span key={range.label}>
              {range.label}
              <small>{range.range}</small>
            </span>
          ))}
        </div>
      </div>
      <p className="scale-caption">
        SEEDED DEMO SCORE · Fixed illustration, not recalculated from local
        inputs
      </p>
    </section>
  );
}
export function SignalStrip() {
  const { view: demo, provenance } = useOperations();
  const signals = [
    {
      label: "Rainfall",
      value: environmentalDemo.rainfallBelowBaseline + "% below baseline",
      source: "JALDRISHTI DEMO · 7 OCT 2026, 14:00 IST",
      icon: CloudRain,
    },
    {
      label: "Soil moisture",
      value: environmentalDemo.soilMoisture,
      source: "JALDRISHTI DEMO · 7 OCT 2026, 14:00 IST",
      icon: Sprout,
    },
    {
      label: "Groundwater",
      value: environmentalDemo.groundwater,
      source: "JALDRISHTI DEMO · 7 OCT 2026, 14:00 IST",
      icon: ArrowDownRight,
    },
    {
      label: "Storage",
      value:
        formatLitres(demo.currentStorage).replace(" L", "") +
        " / " +
        formatLitres(demo.storageCapacity),
      source:
        provenance("currentStorage") +
        " · LOCAL INPUT · SEE SYSTEM FOR TIMESTAMP",
      icon: Waves,
    },
  ];
  return (
    <section className="environmental-signals" aria-labelledby="signals-title">
      <div className="signals-heading">
        <div>
          <Eyebrow>02 / ENVIRONMENTAL CONTEXT</Eyebrow>
          <h2 id="signals-title">Signals behind the pressure</h2>
        </div>
        <Link href="/dashboard/data">
          Seeded context · View public weather data →
        </Link>
      </div>
      <dl>
        {signals.map(({ label, value, source, icon: Icon }) => (
          <div key={label}>
            <dt>
              <Icon size={17} aria-hidden="true" />
              {label}
            </dt>
            <dd>{value}</dd>
            <span className="signal-source">{source}</span>
          </div>
        ))}
      </dl>
    </section>
  );
}
export function Anomaly() {
  const { view: demo, anomaly } = useOperations();
  return (
    <section className="anomaly-module" aria-labelledby="anomaly-title">
      <div className="anomaly-identity">
        <Eyebrow>
          <AlertTriangle size={14} aria-hidden="true" /> ANOMALY 01
        </Eyebrow>
        <h2 id="anomaly-title">BLOCK C</h2>
        <span className="signal-source">{anomaly.provenance}</span>
      </div>
      <div className="anomaly-magnitude">
        <strong>
          {anomaly.variancePercent == null
            ? "—"
            : "+" + demo.anomalyPercent + "%"}
        </strong>
        <span>ABOVE NORMAL DEMAND</span>
      </div>
      <div className="anomaly-detail">
        <p>
          Potential avoidable loss:
          <br />
          <strong>{formatLitres(demo.possibleLoss)}/day</strong>
        </p>
        <p>
          Suggested action:
          <br />
          <strong>{environmentalDemo.anomalyInspection}</strong>
        </p>
      </div>
      <div className="anomaly-actions">
        <ButtonLink href="/dashboard/system#block-c-detail" secondary>
          Investigate
        </ButtonLink>
        <ButtonLink href="/dashboard/simulator?repair=on" secondary>
          Simulate repair
        </ButtonLink>
        <span>Demo-derived · Verify before repair</span>
      </div>
    </section>
  );
}
export function ActionImpact() {
  const { view: demo } = useOperations();
  return (
    <section
      className="intervention-path"
      aria-label="Recommended intervention and expected impact"
    >
      <div className="intervention">
        <Eyebrow>03 / RECOMMENDED ACTION</Eyebrow>
        <div className="action-title">
          <span className="icon-box">
            <Droplets aria-hidden="true" />
          </span>
          <h2>
            {demo.intervention}
            <span>+ reduce consumption by {demo.reductionPercent}%</span>
          </h2>
        </div>
        <p>
          Address the suspected Block C loss and reduce non-essential demand.
        </p>
        <ButtonLink href="/dashboard/actions" secondary>
          Review action
        </ButtonLink>
      </div>
      <div className="impact-connector" aria-hidden="true">
        <span />
        <ArrowRight size={22} />
        <span />
      </div>
      <div className="connected-impact">
        <Eyebrow>04 / EXPECTED IMPACT</Eyebrow>
        <div className="impact-number">
          {demo.resilienceHours === "—" ? "—" : "+" + demo.resilienceHours}
          <span>HOURS</span>
        </div>
        <h2>water resilience</h2>
        <p className="impact-preserved">
          {demo.waterPreserved == null
            ? "Not evaluated within 30 days"
            : formatLitres(demo.waterPreserved) + " preserved"}
        </p>
        <p>
          Illustrative score (not calculated):{" "}
          <strong>{demo.updatedScore} / 100</strong>
        </p>
        <small>
          CALCULATED · From current operational inputs · At baseline critical
          time
        </small>
      </div>
    </section>
  );
}
