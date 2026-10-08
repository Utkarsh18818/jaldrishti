export function Contours() {
  return (
    <div className="terrain" aria-hidden="true">
      <svg viewBox="0 0 680 620" fill="none">
        <defs>
          <radialGradient id="water">
            <stop stopColor="#22D3EE" stopOpacity=".15" />
            <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
          </radialGradient>
          <pattern
            id="grid"
            width="52"
            height="52"
            patternUnits="userSpaceOnUse"
          >
            <path d="M52 0H0V52" stroke="#38BDF8" strokeOpacity=".09" />
          </pattern>
        </defs>
        <rect width="680" height="620" fill="url(#grid)" />
        <circle cx="350" cy="310" r="280" fill="url(#water)" />
        {Array.from({ length: 17 }, (_, i) => (
          <ellipse
            key={i}
            cx={350 + i * 2}
            cy={310 - i * 3}
            rx={65 + i * 15}
            ry={36 + i * 13}
            transform="rotate(-30 350 310)"
            stroke="#38BDF8"
            strokeOpacity={0.55 - i * 0.024}
          />
        ))}
        <path
          d="M350 115V510M140 310H560"
          stroke="#EAF7F7"
          strokeOpacity=".18"
          strokeDasharray="3 7"
        />
        <circle cx="350" cy="310" r="8" fill="#22D3EE" />
        <circle cx="350" cy="310" r="18" stroke="#22D3EE" strokeOpacity=".5" />
      </svg>
      <div className="terrain-label">
        <span className="signal-dot" /> ENVIRONMENTAL INTELLIGENCE
      </div>
      <span className="terrain-coordinate">OBSERVATION FIELD / 01</span>
      <span className="terrain-annotation">
        SURFACE / SUBSURFACE
        <br />
        SIGNAL → DECISION
      </span>
    </div>
  );
}
