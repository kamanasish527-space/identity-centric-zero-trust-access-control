import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { Card } from "../components/ui/card";
import { AlertTriangle, Shield, Activity, Users, Clock, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useDashboard } from "../store/dashboardStore";
import { parseApiTimestamp } from "../utils/time";

function timeAgo(timestamp) {
  const date = parseApiTimestamp(timestamp) || new Date();
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function statusLabel(status) {
  if (status === "red") return "Down";
  if (status === "yellow") return "Degraded";
  return "Healthy";
}

function normalizeSeverity(value) {
  const lower = String(value || "").toLowerCase();
  if (["critical", "high"].includes(lower)) return lower;
  if (lower === "medium") return "medium";
  return "low";
}

export default function ExecutiveOverview() {
  const navigate = useNavigate();
  const dashboard = useDashboard();

  const riskScore = Math.round(Number(dashboard.effectiveRiskScore || 0));
  const trustScore = Math.max(0, 100 - riskScore);

  const riskData = [
    { name: "Safe", value: Math.max(0, 100 - riskScore), color: "#06b6d4" },
    { name: "Risk", value: Math.min(100, riskScore), color: "#ef4444" },
  ];

  const activeSessions = (dashboard.sessions || []).filter((item) => item.is_active);
  const highRiskAttempts = Number(
    dashboard.overview?.high_risk_attempts ??
      (dashboard.logs || []).filter((item) => Number(item.risk_score || 0) > 70).length
  );
  const blockedThreats = (dashboard.logs || []).filter((item) =>
    String(item.decision || "").toLowerCase().includes("deny")
  ).length;
  const eventsToday = (dashboard.logs || []).filter((item) => {
    const ts = parseApiTimestamp(item.timestamp);
    if (!ts) return false;
    return Date.now() - ts.getTime() < 24 * 60 * 60 * 1000;
  }).length;

  const services = useMemo(() => {
    const list = [];
    (dashboard.systemArchitectureHealth?.microservices || []).forEach((service) => {
      list.push({
        name: service.name,
        status: service.status,
        label: statusLabel(service.status),
      });
    });
    if (dashboard.systemArchitectureHealth?.database) {
      const db = dashboard.systemArchitectureHealth.database;
      list.push({
        name: db.name || "Database",
        status: db.status,
        label: statusLabel(db.status),
      });
    }
    return list.slice(0, 5);
  }, [dashboard.systemArchitectureHealth]);

  const recentAlerts = useMemo(() => {
    return (dashboard.threatIntel || []).slice(0, 4).map((alert, index) => ({
      id: alert.id || `${alert.timestamp}-${index}`,
      severity: normalizeSeverity(alert.severity || alert.risk_level),
      title: alert.summary || alert.technique_name || "Threat detected",
      user: alert.user || "unknown",
      ip: alert.ip_address || "203.45.12.9",
      time: timeAgo(alert.timestamp),
    }));
  }, [dashboard.threatIntel]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl text-gray-100 mb-1">Executive Overview</h2>
        <p className="text-sm text-gray-500">Real-time security posture and risk analysis</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-4 p-6 bg-gray-900 border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-300">Risk Score</h3>
            <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
              {riskScore >= 40 ? "Warning" : "Good"}
            </span>
          </div>

          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={70}
                  outerRadius={100}
                  dataKey="value"
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center mt-8">
                <div className="text-4xl font-semibold text-amber-400">{riskScore}</div>
                <div className="text-xs text-gray-500 mt-1">out of 100</div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-semibold text-red-400">{highRiskAttempts}</div>
              <div className="text-xs text-gray-500">High Risk Events</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-amber-400">{Math.round((50 - riskScore) / 2)}%</div>
              <div className="text-xs text-gray-500">vs Last Week</div>
            </div>
          </div>
        </Card>

        <Card className="col-span-4 p-6 bg-gray-900 border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-300">Trust Score</h3>
            <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">Good</span>
          </div>

          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[{ value: trustScore, color: "#06b6d4" }, { value: 100 - trustScore, color: "#1f2937" }]}
                  cx="50%"
                  cy="50%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={70}
                  outerRadius={100}
                  dataKey="value"
                >
                  <Cell fill="#06b6d4" />
                  <Cell fill="#1f2937" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center mt-8">
                <div className="text-4xl font-semibold text-cyan-400">{trustScore}</div>
                <div className="text-xs text-gray-500 mt-1">out of 100</div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-semibold text-cyan-400">{activeSessions.length}</div>
              <div className="text-xs text-gray-500">Trusted Sessions</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-cyan-400">{Math.round((trustScore - 50) / 2)}%</div>
              <div className="text-xs text-gray-500">vs Last Week</div>
            </div>
          </div>
        </Card>

        <Card className="col-span-4 p-6 bg-gray-900 border-gray-800">
          <h3 className="text-gray-300 mb-4">System Health</h3>

          <div className="space-y-4">
            {services.length === 0 ? (
              <div className="text-sm text-gray-500">No service telemetry available.</div>
            ) : (
              services.map((service) => {
                const status = service.status === "red" ? "down" : service.status === "yellow" ? "degraded" : "healthy";
                const Icon = status === "down" ? XCircle : status === "degraded" ? AlertTriangle : CheckCircle;
                const iconColor =
                  status === "down" ? "text-red-400" : status === "degraded" ? "text-amber-400" : "text-cyan-400";
                const badgeColor =
                  status === "down"
                    ? "bg-red-500/10 text-red-400"
                    : status === "degraded"
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-cyan-500/10 text-cyan-400";

                return (
                  <div key={service.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${iconColor}`} />
                      <span className="text-sm text-gray-400">{service.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${badgeColor}`}>{service.label}</span>
                  </div>
                );
              })
            )}
          </div>

          <Button
            className="w-full mt-4 bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
            variant="outline"
            size="sm"
            onClick={() => navigate("/intelligence")}
          >
            View Details
          </Button>
        </Card>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-semibold text-gray-100">{activeSessions.length}</div>
              <div className="text-xs text-gray-500">Active Sessions</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-semibold text-gray-100">{highRiskAttempts}</div>
              <div className="text-xs text-gray-500">High Risk Attempts</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-semibold text-gray-100">{blockedThreats}</div>
              <div className="text-xs text-gray-500">Blocked Threats</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Activity className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-semibold text-gray-100">{eventsToday}</div>
              <div className="text-xs text-gray-500">Events Today</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-8 p-6 bg-gray-900 border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-300">Recent Alerts</h3>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-300" onClick={() => navigate("/data-details")}
            >
              View All
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>

          <div className="space-y-3">
            {recentAlerts.length === 0 ? (
              <div className="text-sm text-gray-500">No active alerts detected.</div>
            ) : (
              recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      alert.severity === "critical"
                        ? "bg-red-500"
                        : alert.severity === "high"
                        ? "bg-amber-500"
                        : "bg-cyan-500"
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-300">{alert.title}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          alert.severity === "critical"
                            ? "bg-red-500/20 text-red-400"
                            : alert.severity === "high"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-cyan-500/20 text-cyan-400"
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>#{String(alert.id).split("-")[0]}</span>
                      <span>&bull;</span>
                      <span>{alert.user}</span>
                      <span>&bull;</span>
                      <span>{alert.ip}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    {alert.time}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="col-span-4 p-6 bg-gray-900 border-gray-800">
          <h3 className="text-gray-300 mb-4">Quick Actions</h3>

          <div className="space-y-2">
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" size="sm" onClick={() => navigate("/simulation")}
            >
              <Shield className="w-4 h-4 mr-2" />
              Run Security Scan
            </Button>

            <Button
              className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300"
              variant="outline"
              size="sm"
              onClick={() => navigate("/network")}
            >
              <Activity className="w-4 h-4 mr-2" />
              View Live Threats
            </Button>

            <Button
              className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300"
              variant="outline"
              size="sm"
              onClick={() => navigate("/behavioral")}
            >
              <Users className="w-4 h-4 mr-2" />
              Manage Sessions
            </Button>

            <Button
              className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300"
              variant="outline"
              size="sm"
              onClick={() => navigate("/intelligence")}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Configure Alerts
            </Button>

            <div className="pt-4 mt-4 border-t border-gray-800">
              <Button
                className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-400 border-red-500/30"
                variant="outline"
                size="sm"
                onClick={() => navigate("/simulation")}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Emergency Lockdown
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
