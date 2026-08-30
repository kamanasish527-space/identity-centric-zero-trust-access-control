import { useMemo, useRef, useState } from "react";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function severityFromRisk(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

const BASE_NODES = [
  { id: "us-east", label: "US East", x: 80, y: 150 },
  { id: "us-west", label: "US West", x: 140, y: 220 },
  { id: "eu-central", label: "EU Central", x: 250, y: 170 },
  { id: "uk", label: "UK", x: 280, y: 120 },
  { id: "asia", label: "Asia Pacific", x: 360, y: 190 },
  { id: "aus", label: "Australia", x: 400, y: 250 },
  { id: "sa", label: "S. America", x: 200, y: 270 },
];

export default function NetworkGraph({ logs = [], sessions = [] }) {
  const containerRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  const nodeStats = useMemo(() => {
    const byNode = new Map();
    BASE_NODES.forEach((node) => {
      byNode.set(node.id, { count: 0, risk: 0 });
    });

    logs.forEach((log) => {
      const risk = clamp(Number(log.risk_score || 0), 0, 100);
      const bucket = risk >= 70 ? "asia" : risk >= 40 ? "eu-central" : "us-east";
      const current = byNode.get(bucket);
      if (current) {
        current.count += 1;
        current.risk = Math.max(current.risk, risk);
      }
    });

    sessions.forEach((session) => {
      const risk = clamp(Number(session.risk_score || 0), 0, 100);
      const bucket = risk >= 70 ? "asia" : risk >= 40 ? "us-west" : "us-east";
      const current = byNode.get(bucket);
      if (current) {
        current.count += 1;
        current.risk = Math.max(current.risk, risk);
      }
    });

    return BASE_NODES.map((node) => {
      const stats = byNode.get(node.id) || { count: 0, risk: 0 };
      return {
        ...node,
        count: stats.count,
        risk: stats.risk,
        severity: severityFromRisk(stats.risk),
      };
    });
  }, [logs, sessions]);

  return (
    <div className="network-graph" ref={containerRef}>
      <svg viewBox="0 0 500 320" width="100%" height="100%">
        <defs>
          <linearGradient id="linkGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(99,102,241,0.35)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0.4)" />
          </linearGradient>
        </defs>

        {nodeStats.map((node) => (
          <line
            key={`line-${node.id}`}
            x1={250}
            y1={170}
            x2={node.x}
            y2={node.y}
            stroke="url(#linkGradient)"
            strokeWidth="1.4"
          />
        ))}

        {nodeStats.map((node) => (
          <g
            key={node.id}
            onMouseEnter={(event) => {
              const rect = containerRef.current?.getBoundingClientRect();
              setHovered({
                ...node,
                x: event.clientX - (rect?.left || 0),
                y: event.clientY - (rect?.top || 0),
              });
            }}
            onMouseLeave={() => setHovered(null)}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={10}
              fill={node.severity === "high" ? "#ef4444" : node.severity === "medium" ? "#f59e0b" : "#22d3ee"}
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="1.2"
            />
            <text x={node.x} y={node.y + 24} fontSize="10" fill="#cbd5f5" textAnchor="middle">
              {node.label}
            </text>
            <text x={node.x} y={node.y + 38} fontSize="9" fill="#8aa0c7" textAnchor="middle">
              {node.count} connections
            </text>
          </g>
        ))}
      </svg>

      <div className="network-legend">
        <span><i className="legend-dot low" /> Low Risk</span>
        <span><i className="legend-dot medium" /> Medium Risk</span>
        <span><i className="legend-dot high" /> High Risk</span>
      </div>

      {hovered && (
        <div
          className="world-map-tooltip"
          style={{ left: hovered.x + 12, top: hovered.y + 12, position: "absolute" }}
        >
          <strong>{hovered.label}</strong>
          <span>Connections: {hovered.count}</span>
          <span>Risk: {hovered.risk || 0}</span>
        </div>
      )}
    </div>
  );
}
