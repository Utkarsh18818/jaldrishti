"use client";
import { useOperations } from "@/features/system/context";
import { formatLitres } from "@/lib/demo-data";
import { Eyebrow } from "@/components/ui";
import {
  Prediction,
  SecurityState,
  SignalStrip,
  ActionImpact,
  Anomaly,
} from "./insights";
export function Overview() {
  const { view: demo, modeLabel, provenance } = useOperations();
  return (
    <>
      <div className="overview-heading">
        <div>
          <Eyebrow>CAMPUS WATER INTELLIGENCE</Eyebrow>
          <h1>
            Overview<span>.</span>
          </h1>
          <p>Your water outlook. Your next move.</p>
        </div>
        <span className="preview-label">MODEL OUTPUT · {modeLabel}</span>
      </div>
      <div className="overview-story">
        <div className="forecast-row">
          <Prediction />
          <SecurityState />
        </div>
        <SignalStrip />
        <Anomaly />
        <ActionImpact />
      </div>
      <section className="conditions">
        <div className="conditions-heading">
          <h2>Local water balance</h2>
          <span>{modeLabel}</span>
        </div>
        <dl>
          {[
            {
              label: "Daily demand",
              value: formatLitres(demo.dailyDemand),
              note:
                provenance("dailyDemand") +
                " · " +
                demo.population +
                " people (" +
                provenance("population") +
                "; context only)",
            },
            {
              label: "Expected daily supply",
              value: formatLitres(demo.expectedDailySupply),
              note: provenance("expectedDailySupply"),
            },
            {
              label: demo.netDeficit < 0 ? "Net surplus" : "Net deficit",
              value: formatLitres(Math.abs(demo.netDeficit)) + "/day",
              note: "CALCULATED · Demand + potential loss − supply",
            },
          ].map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
              <span>{item.note}</span>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
