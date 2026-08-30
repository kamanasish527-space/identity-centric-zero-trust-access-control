import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { TrendingUp, TrendingDown, Brain, ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "../components/ui/progress";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";
import { useDashboard } from "../store/dashboardStore";
import { parseApiTimestamp } from "../utils/time";

const DECISION_COLORS = {
  allow: "#06b6d4",
  block: "#ef4444",
  challenge: "#f59e0b",
  monitor: "#6366f1",
};

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getRiskColor(score) {
  if (score <= 30) return "#06b6d4";
  if (score <= 70) return "#f59e0b";
  return "#ef4444";
}

function describeArc(score) {
  const radius = 100;
  const centerX = 140;
  const centerY = 140;
  const startAngle = 180;
  const endAngle = 180 - (score / 100) * 180;
  const radians = (angle) => (Math.PI / 180) * angle;
  const startX = centerX + radius * Math.cos(radians(startAngle));
  const startY = centerY + radius * Math.sin(radians(startAngle));
  const endX = centerX + radius * Math.cos(radians(endAngle));
  const endY = centerY + radius * Math.sin(radians(endAngle));
  const largeArc = score > 50 ? 1 : 0;
  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;
}

function computeRiskFactors(logs, liveRisk, seed, simulationFactors) {
  if (simulationFactors) {
    const ip = clamp(Number(simulationFactors.ipChange || 0), 0, 100);
    const device = clamp(Number(simulationFactors.deviceChange || 0), 0, 100);
    const loginTime = clamp(Number(simulationFactors.loginTime || 0), 0, 100);
    const geo = clamp(ip * 0.58 + loginTime * 0.42, 0, 100);
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

export default function PredictiveRisk() {
  const dashboard = useDashboard();
  const [aiInsightsOpen, setAiInsightsOpen] = useState(true);

  const backendTrend = useMemo(
    () =>
      (dashboard.riskAnalytics?.trend || [])
        .map((item) => ({
          timestamp: parseApiTimestamp(item.timestamp),
          risk: clamp(Number(item.risk_score || 0), 0, 100),
        }))
        .filter((item) => item.timestamp),
    [dashboard.riskAnalytics?.trend]
  );

  const targetRisk = useMemo(() => {
    if (backendTrend.length > 0) {
      return backendTrend[backendTrend.length - 1].risk;
    }
    return clamp(Number(dashboard.effectiveRiskScore || 0), 0, 100);
  }, [backendTrend, dashboard.effectiveRiskScore]);

  const [liveSeries, setLiveSeries] = useState(() => {
    if (backendTrend.length > 0) {
      return backendTrend.slice(-36);
    }
    return [{ timestamp: new Date(), risk: targetRisk }];
  });

  useEffect(() => {
    if (backendTrend.length === 0) {
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
  }, [backendTrend]);

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
        date: item.timestamp.toLocaleDateString([], { month: "short", day: "2-digit" }),
        score: Number(item.risk || 0),
      })),
    [liveSeries]
  );

  const liveRisk = lineData.length > 0 ? lineData[lineData.length - 1].score : targetRisk;

  const decisionBuckets = useMemo(() => {
    const buckets = { allow: 0, block: 0, challenge: 0, monitor: 0 };
    const breakdown = dashboard.riskAnalytics?.decision_breakdown;
    const source = Array.isArray(breakdown) && breakdown.length > 0 ? breakdown : dashboard.logs;

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
  }, [dashboard.logs, dashboard.riskAnalytics?.decision_breakdown]);

  const decisionData = useMemo(
    () => [
      { name: "Allow", value: decisionBuckets.allow, color: DECISION_COLORS.allow },
      { name: "Block", value: decisionBuckets.block, color: DECISION_COLORS.block },
      { name: "Challenge", value: decisionBuckets.challenge, color: DECISION_COLORS.challenge },
      { name: "Monitor", value: decisionBuckets.monitor, color: DECISION_COLORS.monitor },
    ],
    [decisionBuckets]
  );

  const lastPointTime = liveSeries[liveSeries.length - 1]?.timestamp?.getTime() || Date.now();
  const factorContributions = useMemo(
    () => computeRiskFactors(dashboard.logs, liveRisk, lastPointTime, dashboard.simulation?.factors),
    [dashboard.logs, liveRisk, lastPointTime, dashboard.simulation?.factors]
  );

  const riskFactors = useMemo(() => {
    const base = factorContributions.map((factor) => {
      const change = Math.round((factor.percent - 50) / 4);
      return {
        name: factor.label,
        value: factor.percent,
        trend: change >= 0 ? "up" : "down",
        change: Math.abs(change),
      };
    });

    const extra = [
      { name: "Malware Detection", value: Math.min(100, Math.round((base[0]?.value || 20) * 0.8)), trend: "down", change: 3 },
      { name: "Policy Violations", value: Math.min(100, Math.round((base[1]?.value || 20) * 0.9)), trend: "up", change: 7 },
    ];

    return [...base.slice(0, 3), ...extra, ...base.slice(3, 4)];
  }, [factorContributions]);

  const riskScoreColor = getRiskColor(liveRisk);

  const insightItems = useMemo(() => {
    const items = [];
    if (dashboard.liveRisk?.insight?.summary) {
      items.push({
        title: dashboard.liveRisk.insight.summary,
        description: dashboard.liveRisk.insight.detail || dashboard.liveRisk.insight.recommendation || "Anomaly detected in recent activity.",
        severity: dashboard.liveRisk.insight.severity || "amber",
        meta: dashboard.liveRisk.insight.confidence
          ? `Confidence: ${dashboard.liveRisk.insight.confidence}%`
          : "Confidence: 84%",
      });
    }

    (dashboard.threatIntel || []).slice(0, 2).forEach((alert) => {
      items.push({
        title: alert.summary || alert.technique_name || "Security Signal",
        description: alert.details || alert.message || "Threat telemetry requires additional review.",
        severity: alert.severity === "critical" ? "red" : alert.severity === "high" ? "amber" : "indigo",
        meta: `Detected: ${parseApiTimestamp(alert.timestamp)?.toLocaleTimeString() || "recent"}`,
      });
    });

    return items.slice(0, 3);
  }, [dashboard.liveRisk?.insight, dashboard.threatIntel]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl text-gray-100 mb-1">Predictive & Risk Analytics</h2>
        <p className="text-sm text-gray-500">AI-powered risk assessment and forecasting</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-5 p-6 bg-gray-900 border-gray-800">
          <h3 className="text-gray-300 mb-6">Current Risk Score</h3>

          <div className="relative flex items-center justify-center mb-6">
            <svg width="280" height="180" viewBox="0 0 280 180">
              <path
                d="M 40 140 A 100 100 0 0 1 240 140"
                fill="none"
                stroke="#1f2937"
                strokeWidth="20"
                strokeLinecap="round"
              />
              <path
                d={describeArc(liveRisk)}
                fill="none"
                stroke={riskScoreColor}
                strokeWidth="20"
                strokeLinecap="round"
              />
              <text x="140" y="120" textAnchor="middle" fill={riskScoreColor} fontSize="48" fontWeight="600">
                {Math.round(liveRisk)}
              </text>
              <text x="140" y="145" textAnchor="middle" fill="#6b7280" fontSize="14">
                Risk Score
              </text>
            </svg>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800">
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">Min</div>
              <div className="text-lg font-semibold text-gray-300">{Math.round(Math.min(...lineData.map((d) => d.score)))}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">Avg</div>
              <div className="text-lg font-semibold text-gray-300">
                {Math.round(lineData.reduce((sum, item) => sum + item.score, 0) / Math.max(1, lineData.length))}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">Max</div>
              <div className="text-lg font-semibold text-gray-300">{Math.round(Math.max(...lineData.map((d) => d.score)))}</div>
            </div>
          </div>
        </Card>

        <Card className="col-span-7 p-6 bg-gray-900 border-gray-800">
          <h3 className="text-gray-300 mb-4">Decision Distribution (24h)</h3>

          <div className="flex items-center gap-6">
            <div className="flex-shrink-0">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={decisionData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
                    {decisionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "6px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4">
              {decisionData.map((item) => (
                <div key={item.name} className="p-3 bg-gray-800/50 rounded-lg border border-gray-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                    <span className="text-sm text-gray-400">{item.name}</span>
                  </div>
                  <div className="text-2xl font-semibold text-gray-100">{item.value.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {((item.value / decisionData.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-gray-900 border-gray-800">
        <h3 className="text-gray-300 mb-4">Risk Factors Breakdown</h3>

        <div className="grid grid-cols-2 gap-6">
          {riskFactors.map((factor) => (
            <div key={factor.name}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">{factor.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-300">{factor.value}%</span>
                  {factor.trend === "up" ? (
                    <div className="flex items-center gap-1 text-xs text-red-400">
                      <TrendingUp className="w-3 h-3" />
                      {factor.change}%
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-cyan-400">
                      <TrendingDown className="w-3 h-3" />
                      {Math.abs(factor.change)}%
                    </div>
                  )}
                </div>
              </div>
              <Progress value={factor.value} className="h-2" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 bg-gray-900 border-gray-800">
        <h3 className="text-gray-300 mb-4">Risk Score Over Time (7 Days)</h3>

        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={lineData}>
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={riskScoreColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={riskScoreColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 12 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "6px" }} labelStyle={{ color: "#9ca3af" }} />
            <Area type="monotone" dataKey="score" stroke={riskScoreColor} strokeWidth={2} fillOpacity={1} fill="url(#riskGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Collapsible open={aiInsightsOpen} onOpenChange={setAiInsightsOpen}>
        <Card className="bg-gray-900 border-gray-800">
          <CollapsibleTrigger asChild>
            <button className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-800/50 transition-colors">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-400" />
                <h3 className="text-gray-300">AI Security Insights</h3>
                <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">{insightItems.length} new</span>
              </div>
              {aiInsightsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-6 space-y-3">
              {insightItems.length === 0 ? (
                <div className="text-sm text-gray-500">No new insights generated.</div>
              ) : (
                insightItems.map((item, index) => {
                  const tone = item.severity === "red" ? "red" : item.severity === "amber" ? "amber" : "indigo";
                  const toneClasses =
                    tone === "red"
                      ? "bg-red-500/10 border-red-500/30"
                      : tone === "amber"
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-indigo-500/10 border-indigo-500/30";
                  const dotClass =
                    tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-indigo-500";

                  return (
                    <div key={index} className={`p-4 ${toneClasses} rounded-lg border`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full ${dotClass} mt-1.5`} />
                        <div className="flex-1">
                          <div className="font-medium text-gray-200 mb-1">{item.title}</div>
                          <p className="text-sm text-gray-400 mb-2">{item.description}</p>
                          <div className="text-xs text-gray-500">{item.meta}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
