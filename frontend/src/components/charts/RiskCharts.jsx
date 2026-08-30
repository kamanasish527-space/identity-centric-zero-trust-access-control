import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { parseApiTimestamp } from "../../utils/time";

const DECISION_COLORS = {
  allow: "#22d3ee",
  block: "#ef4444",
  challenge: "#f59e0b",
  monitor: "#6366f1",
  unknown: "#64748b",
};

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getRiskColor(score) {
  if (score <= 30) {
    return "#22d3ee";
  }
  if (score <= 70) {
    return "#f59e0b";
  }
  return "#ef4444";
}

function computeRiskFactors(logs, liveRisk, seed, simulationFactors) {
  if (simulationFactors) {
    const ip = clamp(Number(simulationFactors.ipChange || 0), 0, 100);
    const device = clamp(Number(simulationFactors.deviceChange || 0), 0, 100);
    const loginTime = clamp(Number(simulationFactors.loginTime || 0), 0, 100);
    const geo = clamp((ip * 0.58) + (loginTime * 0.42), 0, 100);
    const total = Math.max(1, ip + device + loginTime + geo);
    const raw = [
      { key: "failed", label: "Failed Authentication", value: ip },
      { key: "access", label: "Unusual Access Patterns", value: device },
      { key: "exfil", label: "Data Exfiltration Risk", value: loginTime },
      { key: "priv", label: "Privilege Escalation", value: geo },
    ];
    return raw.map((item, index) => {
      if (index === raw.length - 1) {
        const used = raw
          .slice(0, raw.length - 1)
          .reduce((sum, prev) => sum + Math.round((prev.value / total) * 100), 0);
        return { ...item, percent: Math.max(0, 100 - used) };
      }
      return { ...item, percent: Math.round((item.value / total) * 100) };
    });
  }

  const factors = {
    failed: 18,
    access: 18,
    exfil: 18,
    priv: 18,
  };

  const recentLogs = (logs || []).slice(0, 32);
  recentLogs.forEach((log) => {
    const message = String(log?.message || "").toLowerCase();
    const action = String(log?.action || "").toLowerCase();
    const technique = String(log?.mitre_technique_id || "").toUpperCase();

    if (message.includes("login") || action.includes("login") || technique === "T1110") {
      factors.failed += 8;
    }

    if (message.includes("access") || action.includes("access") || technique === "T1078") {
      factors.access += 7;
    }

    if (message.includes("exfil") || message.includes("transfer") || technique === "T1041") {
      factors.exfil += 9;
    }

    if (message.includes("privilege") || technique === "T1068") {
      factors.priv += 8;
    }
  });

  const riskAmplifier = clamp(Number(liveRisk || 0), 0, 100) / 100;
  factors.failed += riskAmplifier * 9;
  factors.access += riskAmplifier * 8;
  factors.exfil += riskAmplifier * 7;
  factors.priv += riskAmplifier * 10;

  const t = seed / 5000;
  factors.failed += Math.sin(t) * 2.4;
  factors.access += Math.cos(t + 0.7) * 2.1;
  factors.exfil += Math.sin(t + 1.3) * 2.3;
  factors.priv += Math.cos(t + 2.1) * 2.2;

  const entries = [
    { key: "failed", label: "Failed Authentication", value: Math.max(1, factors.failed) },
    { key: "access", label: "Unusual Access Patterns", value: Math.max(1, factors.access) },
    { key: "exfil", label: "Data Exfiltration Risk", value: Math.max(1, factors.exfil) },
    { key: "priv", label: "Privilege Escalation", value: Math.max(1, factors.priv) },
  ];

  const total = entries.reduce((sum, item) => sum + item.value, 0);
  return entries.map((item, index) => {
    if (index === entries.length - 1) {
      const used = entries
        .slice(0, entries.length - 1)
        .reduce((sum, prev) => sum + Math.round((prev.value / total) * 100), 0);
      return { ...item, percent: Math.max(0, 100 - used) };
    }
    return { ...item, percent: Math.round((item.value / total) * 100) };
  });
}

function RiskGauge({ value, min, avg, max }) {
  const score = clamp(Number(value || 0), 0, 100);
  const gaugeColor = getRiskColor(score);

  const size = 220;
  const radius = 82;
  const strokeWidth = 14;
  const center = size / 2;
  const startAngle = Math.PI;
  const progressAngle = Math.PI * (1 - score / 100);
  const startX = center + radius * Math.cos(startAngle);
  const startY = center + radius * Math.sin(startAngle);
  const endX = center + radius * Math.cos(progressAngle);
  const endY = center + radius * Math.sin(progressAngle);
  const largeArc = score > 50 ? 1 : 0;
  const trackPath = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`;
  const progressPath = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;

  return (
    <article className="card gauge-card">
      <div className="card-head">
        <h3>Current Risk Score</h3>
      </div>
      <div className="gauge-wrap">
        <svg width={size} height={120} viewBox={`0 0 ${size} 120`}>
          <path d={trackPath} stroke="rgba(148,163,184,0.24)" strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
          <path d={progressPath} stroke={gaugeColor} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        </svg>
        <div className="gauge-center">
          <strong style={{ color: gaugeColor }}>{Math.round(score)}</strong>
          <span>Risk Score</span>
        </div>
      </div>
      <div className="gauge-metrics">
        <div>
          <small>Min</small>
          <strong>{Number(min || 0).toFixed(0)}</strong>
        </div>
        <div>
          <small>Avg</small>
          <strong>{Number(avg || 0).toFixed(0)}</strong>
        </div>
        <div>
          <small>Max</small>
          <strong>{Number(max || 0).toFixed(0)}</strong>
        </div>
      </div>
    </article>
  );
}

export default function RiskCharts({
  riskAnalytics,
  logs,
  sessions,
  currentRisk,
  spikeSeed = 0,
  simulationFactors = null,
  simulationMitre = [],
  simulationActive = false,
  showMitreMatrix = true,
  showGlobalMap = true,
}) {
  const backendTrend = useMemo(
    () =>
      (riskAnalytics?.trend || [])
        .map((item) => ({
          timestamp: parseApiTimestamp(item.timestamp),
          risk: clamp(Number(item.risk_score || 0), 0, 100),
        }))
        .filter((item) => item.timestamp),
    [riskAnalytics?.trend]
  );

  const targetRisk = useMemo(() => {
    if (backendTrend.length > 0) {
      return backendTrend[backendTrend.length - 1].risk;
    }
    return clamp(Number(currentRisk || 0), 0, 100);
  }, [backendTrend, currentRisk]);

  const [liveSeries, setLiveSeries] = useState(() => {
    if (backendTrend.length > 0) {
      return backendTrend.slice(-36);
    }
    return [{ timestamp: new Date(), risk: targetRisk }];
  });

  useEffect(() => {
    if (backendTrend.length === 0) {
      setLiveSeries((prev) => (prev.length > 0 ? prev : [{ timestamp: new Date(), risk: targetRisk }]));
      return;
    }

    const incoming = backendTrend.slice(-36);
    setLiveSeries((prev) => {
      const prevLast = prev[prev.length - 1]?.timestamp?.getTime();
      const nextLast = incoming[incoming.length - 1]?.timestamp?.getTime();
      if (!prevLast || !nextLast || prevLast !== nextLast) {
        return incoming;
      }
      return prev;
    });
  }, [backendTrend, targetRisk]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLiveSeries((prev) => {
        const last = prev[prev.length - 1] || { timestamp: new Date(), risk: targetRisk };
        const drift = (targetRisk - last.risk) * 0.38;
        const volatility = targetRisk >= 70 ? 7 : targetRisk >= 31 ? 5.5 : 4;
        const noise = (Math.random() - 0.5) * volatility;
        const nextRisk = clamp(last.risk + drift + noise, 0, 100);

        return [
          ...prev.slice(-47),
          {
            timestamp: new Date(),
            risk: Number(nextRisk.toFixed(2)),
          },
        ];
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [targetRisk]);

  const lineData = useMemo(
    () =>
      liveSeries.map((item) => ({
        time: item.timestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        risk: Number(item.risk || 0),
      })),
    [liveSeries]
  );

  const liveRisk = lineData.length > 0 ? lineData[lineData.length - 1].risk : targetRisk;

  const decisionBuckets = useMemo(() => {
    const buckets = { allow: 0, block: 0, challenge: 0, monitor: 0 };
    const breakdown = riskAnalytics?.decision_breakdown;
    const source = Array.isArray(breakdown) && breakdown.length > 0 ? breakdown : logs;

    const assignBucket = (decision) => {
      const value = String(decision || "").toLowerCase();
      if (value.includes("allow")) return "allow";
      if (value.includes("step") || value.includes("challenge")) return "challenge";
      if (value.includes("monitor")) return "monitor";
      if (value.includes("deny") || value.includes("lock")) return "block";
      return "monitor";
    };

    source.forEach((item) => {
      if (breakdown) {
        const bucket = assignBucket(item.decision);
        buckets[bucket] += Number(item.count || 0);
      } else {
        const bucket = assignBucket(item.decision || item.policy_decision);
        buckets[bucket] += 1;
      }
    });

    return buckets;
  }, [logs, riskAnalytics?.decision_breakdown]);

  const decisionData = useMemo(
    () => [
      { key: "allow", label: "Allow", value: decisionBuckets.allow },
      { key: "block", label: "Block", value: decisionBuckets.block },
      { key: "challenge", label: "Challenge", value: decisionBuckets.challenge },
      { key: "monitor", label: "Monitor", value: decisionBuckets.monitor },
    ],
    [decisionBuckets]
  );

  const lastPointTime = liveSeries[liveSeries.length - 1]?.timestamp?.getTime() || Date.now();
  const factorContributions = useMemo(
    () => computeRiskFactors(logs, liveRisk, lastPointTime, simulationFactors),
    [logs, liveRisk, lastPointTime, simulationFactors]
  );

  const extraFactors = useMemo(() => {
    const base = factorContributions;
    if (base.length < 4) return base;
    const malware = Math.min(100, Math.round((base[0].percent + base[2].percent) / 2 + 6));
    const policy = Math.max(8, Math.round((base[1].percent + base[3].percent) / 2 - 4));
    return [
      base[0],
      { key: "malware", label: "Malware Detection", percent: malware },
      base[2],
      base[1],
      { key: "policy", label: "Policy Violations", percent: policy },
      base[3],
    ];
  }, [factorContributions]);

  const minRisk = Math.min(...lineData.map((item) => item.risk));
  const maxRisk = Math.max(...lineData.map((item) => item.risk));
  const avgRisk =
    lineData.length > 0
      ? lineData.reduce((sum, item) => sum + item.risk, 0) / lineData.length
      : liveRisk;

  return (
    <div className="risk-stack">
      <section className="grid risk-top">
        <RiskGauge value={liveRisk} min={minRisk} avg={avgRisk} max={maxRisk} />
        <article className="card decision-card">
          <div className="card-head">
            <h3>Decision Distribution (24h)</h3>
          </div>
          <div className="decision-grid">
            <div className="decision-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={decisionData}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius="80%"
                    innerRadius="58%"
                    paddingAngle={2}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={1}
                    isAnimationActive
                  >
                    {decisionData.map((entry) => (
                      <Cell key={entry.key} fill={DECISION_COLORS[entry.key] || DECISION_COLORS.unknown} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="decision-legend">
              {decisionData.map((entry) => {
                const total = decisionData.reduce((sum, item) => sum + item.value, 0) || 1;
                const percent = Math.round((entry.value / total) * 100);
                return (
                  <div key={`legend-${entry.key}`} className="decision-row">
                    <span>
                      <i style={{ backgroundColor: DECISION_COLORS[entry.key] || DECISION_COLORS.unknown }} />
                      {entry.label}
                    </span>
                    <div>
                      <strong>{entry.value.toLocaleString()}</strong>
                      <small>{percent}%</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </article>
      </section>

      <section className="card risk-factors">
        <div className="card-head">
          <h3>Risk Factors Breakdown</h3>
        </div>
        <div className="factor-grid">
          {extraFactors.map((factor) => (
            <div key={factor.key} className="factor-row">
              <div>
                <strong>{factor.label}</strong>
                <span>{factor.percent}%</span>
              </div>
              <div className="factor-bar">
                <span style={{ width: `${factor.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card risk-line">
        <div className="card-head">
          <h3>Risk Score Over Time (7 Days)</h3>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={lineData}>
              <defs>
                <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
              <XAxis dataKey="time" stroke="#94a3b8" minTickGap={28} />
              <YAxis stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="risk"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#riskFill)"
                isAnimationActive
                animationDuration={520}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
