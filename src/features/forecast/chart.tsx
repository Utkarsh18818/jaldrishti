import type { ForecastResult } from "./model";
import { forecastPolicy } from "./policy";
interface ChartProps {
  baseline: ForecastResult;
  intervention: ForecastResult;
  capacity: number;
  comparisonLabel?: string;
  basisLabel?: string;
  reserves?: { warning: number; critical: number };
  startLabel?: string;
}
export function StorageChart(props: ChartProps) {
  return (
    <div className="storage-chart">
      <ChartPlot {...props} />
      <ChartPlot {...props} mobile />
      <div className="chart-legend">
        <span>
          <i className="baseline-key" />
          Baseline
        </span>
        <span>
          <i className="intervention-key" />
          {props.comparisonLabel ?? "Recommended intervention"}
        </span>
        <span>{props.basisLabel ?? "SEEDED DEMO · CONSTANT RATES"}</span>
      </div>
    </div>
  );
}
function ChartPlot({
  baseline,
  intervention,
  capacity,
  mobile = false,
  comparisonLabel = "Recommended intervention",
  reserves = {
    warning: forecastPolicy.warningReserveLitres,
    critical: forecastPolicy.criticalReserveLitres,
  },
  startLabel = "Today (demo start)",
}: ChartProps & { mobile?: boolean }) {
  const width = mobile ? 360 : 760,
    height = mobile ? 270 : 340,
    left = mobile ? 46 : 66,
    right = mobile ? 12 : 24,
    top = 25,
    bottom = 52,
    plotW = width - left - right,
    plotH = height - top - bottom;
  const suffix = mobile ? "mobile" : "desktop";
  const x = (day: number) => left + (day / baseline.horizonDays) * plotW;
  const y = (storage: number) => top + (1 - storage / capacity) * plotH;
  const line = (result: ForecastResult) =>
    result.points.map((p) => x(p.day) + "," + y(p.storageLitres)).join(" ");
  return (
    <svg
      className={mobile ? "forecast-chart-mobile" : "forecast-chart-desktop"}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`storage-chart-title-${suffix} storage-chart-description-${suffix}`}
    >
      <title id={`storage-chart-title-${suffix}`}>
        {`Storage trajectories over ${baseline.horizonDays} days`}
      </title>
      <desc id={`storage-chart-description-${suffix}`}>
        Solid cyan: baseline. Dashed teal: {comparisonLabel}. Warning at{" "}
        {reserves.warning} litres. Critical reserve at {reserves.critical}{" "}
        litres. Operational starting storage is{" "}
        {baseline.points[0].storageLitres} litres. Exact daily values are
        available in the table below.
      </desc>
      {[0, capacity / 2, capacity].map((value) => (
        <g key={value}>
          <line
            x1={left}
            x2={width - right}
            y1={y(value)}
            y2={y(value)}
            stroke="#25434e"
          />
          <text x={left - 10} y={y(value) + 4} textAnchor="end">
            {value / 1000}k L
          </text>
        </g>
      ))}
      {[
        {
          value: reserves.warning,
          label: "Warning",
          color: "#f2df79",
        },
        {
          value: reserves.critical,
          label: "Critical reserve",
          color: "#ffbe66",
        },
      ].map((t) => (
        <g key={t.label}>
          <line
            x1={left}
            x2={width - right}
            y1={y(t.value)}
            y2={y(t.value)}
            stroke={t.color}
            strokeDasharray="4 6"
            strokeOpacity=".55"
          />
          <text x={width - right} y={y(t.value) - 6} textAnchor="end">
            {t.label}
          </text>
        </g>
      ))}
      <line
        x1={left}
        x2={left}
        y1={top}
        y2={height - bottom}
        stroke="#9cbbc6"
        strokeDasharray="2 5"
      />
      <polyline
        key={line(intervention)}
        className="scenario-line"
        points={line(intervention)}
        stroke="#2dd4bf"
        strokeWidth="2.5"
        strokeDasharray="8 5"
        fill="none"
      />
      <polyline
        points={line(baseline)}
        stroke="#22d3ee"
        strokeWidth="3"
        fill="none"
      />
      <circle
        cx={left}
        cy={y(baseline.points[0].storageLitres)}
        r="4"
        fill="#eaf7f7"
      />
      {[0, Math.round(baseline.horizonDays / 2), baseline.horizonDays].map(
        (day) => (
          <text
            key={day}
            x={x(day)}
            y={height - 19}
            textAnchor={
              day === 0
                ? "start"
                : day === baseline.horizonDays
                  ? "end"
                  : "middle"
            }
          >
            {day === 0 ? (mobile ? "Start" : startLabel) : "Day " + day}
          </text>
        ),
      )}
    </svg>
  );
}
