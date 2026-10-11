"use client";
import { useState } from "react";
import { Download, ClipboardCheck } from "lucide-react";
import { buildDecisionBrief } from "./brief";
import type { DecisionContext } from "./brief";
import type { ScenarioControls } from "../simulator/adapter";

export function DecisionBrief({ context, controls }: { context: DecisionContext; controls: ScenarioControls }) {
  const [notice, setNotice] = useState("");
  const brief = buildDecisionBrief(context, controls);
  const comparison = brief.comparison;
  const headline = comparison.outcome === "later"
    ? `Critical reserve moves ${(comparison.changeHours! / 24).toFixed(1)} days later.`
    : comparison.outcome === "earlier"
      ? `Critical reserve arrives ${(Math.abs(comparison.changeHours!) / 24).toFixed(1)} days earlier.`
      : comparison.outcome === "lower-bound"
        ? `At least ${(comparison.lowerBoundHours! / 24).toFixed(1)} additional days within this window.`
        : comparison.outcome === "unchanged" ? "This scenario keeps the same reserve window."
          : "No baseline critical crossing within this comparison window.";
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(brief, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = context.mode === "SAMPLE_DEMO" ? "jaldrishti-synthetic-decision-brief.json" : "jaldrishti-real-decision-brief.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setNotice("Decision brief prepared locally. Check browser downloads. No data was uploaded.");
  }
  return (
    <section className="decision-brief" aria-labelledby="decision-brief-title">
      <div className="decision-brief-top"><p className="eyebrow"><ClipboardCheck size={16} /> FROM MODEL TO DECISION</p>
        <span className="decision-basis">{context.mode === "SAMPLE_DEMO" ? "SYNTHETIC SAMPLE" : "REAL ANALYSIS · MODEL OUTPUT"}</span></div>
      <h2 id="decision-brief-title">{headline}</h2>
      <p className="decision-brief-explanation">Compare the assumptions, then check them with your site operator. This is a modeled reserve window, not a guarantee or a measurement of water saved.</p>
      <dl className="decision-assumptions">
        <div><dt>Demand reduction</dt><dd>{controls.reductionPercent}%</dd></div>
        <div><dt>One-time top-up</dt><dd>{controls.supplementaryLitres.toLocaleString()} L</dd></div>
        <div><dt>Supply delay</dt><dd>{controls.supplyDelayDays} days</dd></div>
        <div><dt>Additional loss</dt><dd>{controls.repairAnomaly ? "Removal assumed" : "Retained"}</dd></div>
      </dl>
      <div className="decision-brief-bottom"><details><summary>Before you act: verify these assumptions</summary><ol>{brief.verifyBeforeActing.map(item => <li key={item}>{item}</li>)}</ol>
        <p>Comparison horizon: {comparison.horizonDays} days. Baseline reading: {new Date(brief.input.startTimeMs).toISOString()}. Demand multiplier: {controls.occupancyPercent}%.</p></details>
        <button type="button" className="button" onClick={download}><Download size={16} /> Download decision brief</button></div>
      <p className="decision-download-note">Local JSON download includes operational inputs, provenance, scenario assumptions and limitations. Keep site information private.</p>
      <p role="status" className="decision-download-status">{notice}</p>
    </section>
  );
}
