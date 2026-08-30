import { useEffect, useMemo, useState } from "react";

import { Card } from "../components/ui/card";
import { Activity, Cpu, HardDrive, Zap, Database, Server, Cloud, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { useDashboard } from "../store/dashboardStore";

function buildSeries(base, spread = 8) {
  return Array.from({ length: 6 }, (_, idx) => {
    const jitter = (Math.random() - 0.5) * spread;
    return {
      time: `${String(idx * 4).padStart(2, "0")}:00`,
      value: Math.max(0, Math.round(base + jitter)),
    };
  });
}

function statusLabel(status) {
  if (status === "red" || status === "down") return "down";
  if (status === "yellow" || status === "degraded") return "degraded";
  return "healthy";
}

export default function ActionableIntelligence() {
  const dashboard = useDashboard();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [configSection, setConfigSection] = useState(null);
  const [configStatus, setConfigStatus] = useState({ saving: false, error: "", saved: "" });
  const [configForm, setConfigForm] = useState({
    lowRisk: 30,
    mediumRisk: 60,
    highRisk: 80,
    sessionInterval: 20,
    continuousMonitoring: true,
    mitreMapping: true,
    dataRetentionDays: 30,
    autoScaling: true,
    loadBalancing: true,
    cacheTtl: 60,
    backupSchedule: "Daily 02:00 UTC",
    updatePolicy: true,
    maintenanceWindow: "Sun 01:00-02:00 UTC",
  });
  const configSections = useMemo(
    () => ({
      alerts: {
        key: "alerts",
        group: "Monitoring",
        title: "Configure Alerts",
        description: "Adjust alerting rules and real-time monitoring toggles.",
      },
      thresholds: {
        key: "thresholds",
        group: "Monitoring",
        title: "Metric Thresholds",
        description: "Tune the risk scoring thresholds and monitoring intervals.",
      },
      retention: {
        key: "retention",
        group: "Monitoring",
        title: "Data Retention",
        description: "Control how long telemetry and audit logs remain in storage.",
      },
      autoscaling: {
        key: "autoscaling",
        group: "Performance",
        title: "Auto-Scaling",
        description: "Set automated capacity scaling for peak load periods.",
      },
      loadbalancing: {
        key: "loadbalancing",
        group: "Performance",
        title: "Load Balancing",
        description: "Toggle traffic distribution across service nodes.",
      },
      cache: {
        key: "cache",
        group: "Performance",
        title: "Cache Settings",
        description: "Control cache TTL and response acceleration policies.",
      },
      backup: {
        key: "backup",
        group: "Maintenance",
        title: "Backup Schedule",
        description: "Manage backup cadence and restore readiness.",
      },
      update: {
        key: "update",
        group: "Maintenance",
        title: "Update Policy",
        description: "Enable automated patching and maintenance updates.",
      },
      maintenance: {
        key: "maintenance",
        group: "Maintenance",
        title: "Maintenance Window",
        description: "Set the weekly maintenance window for system downtime.",
      },
    }),
    []
  );

  const metrics = dashboard.metrics || {
    apiLatency: 45,
    cpuUsage: 72,
    memoryUsage: 68,
    uptime: 99.8,
  };

  useEffect(() => {
    if (!dashboard.settings) return;
    setConfigForm((prev) => ({
      ...prev,
      lowRisk: Number(dashboard.settings.risk_low_threshold ?? prev.lowRisk),
      mediumRisk: Number(dashboard.settings.risk_medium_threshold ?? prev.mediumRisk),
      highRisk: Number(dashboard.settings.risk_high_threshold ?? prev.highRisk),
      sessionInterval: Number(dashboard.settings.session_monitor_interval_seconds ?? prev.sessionInterval),
      continuousMonitoring: Boolean(
        dashboard.settings.continuous_monitoring_enabled ?? prev.continuousMonitoring
      ),
      mitreMapping: Boolean(dashboard.settings.mitre_mapping_enabled ?? prev.mitreMapping),
    }));
  }, [dashboard.settings]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("systemConfig");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      setConfigForm((prev) => ({
        ...prev,
        dataRetentionDays: Number(parsed.dataRetentionDays ?? prev.dataRetentionDays),
        autoScaling: Boolean(parsed.autoScaling ?? prev.autoScaling),
        loadBalancing: Boolean(parsed.loadBalancing ?? prev.loadBalancing),
        cacheTtl: Number(parsed.cacheTtl ?? prev.cacheTtl),
        backupSchedule: parsed.backupSchedule ?? prev.backupSchedule,
        updatePolicy: Boolean(parsed.updatePolicy ?? prev.updatePolicy),
        maintenanceWindow: parsed.maintenanceWindow ?? prev.maintenanceWindow,
      }));
    } catch (err) {
      console.warn("Failed to load system configuration", err);
    }
  }, []);

  const openConfig = (section) => {
    setConfigSection(section);
    setConfigStatus({ saving: false, error: "", saved: "" });
    setConfigOpen(true);
  };

  const updateForm = (key, value) => {
    setConfigForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setConfigStatus({ saving: true, error: "", saved: "" });
    try {
      if (configSection?.group === "Monitoring") {
        await dashboard.actions.saveSettings({
          risk_low_threshold: Number(configForm.lowRisk),
          risk_medium_threshold: Number(configForm.mediumRisk),
          risk_high_threshold: Number(configForm.highRisk),
          session_monitor_interval_seconds: Number(configForm.sessionInterval),
          continuous_monitoring_enabled: Boolean(configForm.continuousMonitoring),
          mitre_mapping_enabled: Boolean(configForm.mitreMapping),
        });
      } else {
        const localPayload = {
          dataRetentionDays: Number(configForm.dataRetentionDays),
          autoScaling: Boolean(configForm.autoScaling),
          loadBalancing: Boolean(configForm.loadBalancing),
          cacheTtl: Number(configForm.cacheTtl),
          backupSchedule: configForm.backupSchedule,
          updatePolicy: Boolean(configForm.updatePolicy),
          maintenanceWindow: configForm.maintenanceWindow,
        };
        window.localStorage.setItem("systemConfig", JSON.stringify(localPayload));
      }

      setConfigStatus({ saving: false, error: "", saved: "Configuration updated" });
      window.setTimeout(() => setConfigStatus((prev) => ({ ...prev, saved: "" })), 2000);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const detailMessage = Array.isArray(detail)
        ? detail.map((item) => item?.msg).filter(Boolean).join(", ")
        : typeof detail === "string"
        ? detail
        : "";
      setConfigStatus({
        saving: false,
        error: detailMessage || err?.response?.data?.error?.message || "Failed to save configuration",
        saved: "",
      });
    }
  };

  const ToggleField = ({ label, description, value, onChange }) => (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3">
      <div>
        <div className="text-sm text-gray-200">{label}</div>
        {description && <div className="text-xs text-gray-500 mt-1">{description}</div>}
      </div>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-500"
      />
    </label>
  );

  const apiLatencyData = useMemo(() => buildSeries(metrics.apiLatency, 18).map((item) => ({ time: item.time, latency: item.value })), [metrics.apiLatency]);
  const cpuData = useMemo(() => buildSeries(metrics.cpuUsage, 14).map((item) => ({ time: item.time, usage: item.value })), [metrics.cpuUsage]);
  const memoryData = useMemo(() => buildSeries(metrics.memoryUsage, 10).map((item) => ({ time: item.time, usage: item.value })), [metrics.memoryUsage]);

  const services = useMemo(() => {
    const list = [];
    (dashboard.systemArchitectureHealth?.microservices || []).forEach((service) => {
      list.push({
        name: service.name,
        status: statusLabel(service.status),
        uptime: service.uptime_percent ? `${service.uptime_percent.toFixed(2)}%` : "99.9%",
        latency: service.latency_ms ? `${service.latency_ms}ms` : "-",
        requests: service.requests ? `${service.requests}` : "-",
      });
    });

    if (dashboard.systemArchitectureHealth?.database) {
      const db = dashboard.systemArchitectureHealth.database;
      list.push({
        name: db.name || "Database Primary",
        status: statusLabel(db.status),
        uptime: db.uptime_percent ? `${db.uptime_percent.toFixed(2)}%` : "99.9%",
        latency: db.latency_ms ? `${db.latency_ms}ms` : "-",
        requests: db.requests ? `${db.requests}` : "-",
      });
    }

    return list;
  }, [dashboard.systemArchitectureHealth]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl text-gray-100 mb-1">Actionable Intelligence</h2>
        <p className="text-sm text-gray-500">System health monitoring and performance metrics</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500">API Latency</div>
              <div className="text-2xl font-semibold text-gray-100">{Math.round(metrics.apiLatency)}ms</div>
            </div>
          </div>
          <Progress value={Math.min(100, metrics.apiLatency)} className="h-1.5" />
          <div className="text-xs text-gray-500 mt-2">Avg response time</div>
        </Card>

        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Cpu className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500">CPU Usage</div>
              <div className="text-2xl font-semibold text-gray-100">{Math.round(metrics.cpuUsage)}%</div>
            </div>
          </div>
          <Progress value={metrics.cpuUsage} className="h-1.5" />
          <div className="text-xs text-gray-500 mt-2">Current utilization</div>
        </Card>

        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <HardDrive className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500">Memory Usage</div>
              <div className="text-2xl font-semibold text-gray-100">{Math.round(metrics.memoryUsage)}%</div>
            </div>
          </div>
          <Progress value={metrics.memoryUsage} className="h-1.5" />
          <div className="text-xs text-gray-500 mt-2">12.8 GB / 18 GB</div>
        </Card>

        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Activity className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500">System Uptime</div>
              <div className="text-2xl font-semibold text-gray-100">{metrics.uptime.toFixed(1)}%</div>
            </div>
          </div>
          <Progress value={metrics.uptime} className="h-1.5" />
          <div className="text-xs text-gray-500 mt-2">45 days, 12 hours</div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="p-6 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-indigo-400" />
            <h3 className="text-gray-300">API Latency (24h)</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={apiLatencyData}>
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 11 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "6px" }} />
              <Area type="monotone" dataKey="latency" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#latencyGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-amber-400" />
            <h3 className="text-gray-300">CPU Usage (24h)</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={cpuData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 11 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "6px" }} />
              <Line type="monotone" dataKey="usage" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            <h3 className="text-gray-300">Memory Usage (24h)</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={memoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 11 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "6px" }} />
              <Line type="monotone" dataKey="usage" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-6 bg-gray-900 border-gray-800">
        <h3 className="text-gray-300 mb-4">Service Health Status</h3>

        <div className="grid grid-cols-2 gap-4">
          {services.length === 0 ? (
            <div className="text-sm text-gray-500">No service telemetry available.</div>
          ) : (
            services.map((service, index) => (
              <div key={index} className="p-4 bg-gray-800/50 rounded-lg border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        service.status === "healthy"
                          ? "bg-cyan-500/10"
                          : service.status === "degraded"
                          ? "bg-amber-500/10"
                          : "bg-red-500/10"
                      }`}
                    >
                      {service.name.includes("API") ? (
                        <Server
                          className={`w-4 h-4 ${
                            service.status === "healthy"
                              ? "text-cyan-400"
                              : service.status === "degraded"
                              ? "text-amber-400"
                              : "text-red-400"
                          }`}
                        />
                      ) : service.name.includes("Database") ? (
                        <Database
                          className={`w-4 h-4 ${
                            service.status === "healthy"
                              ? "text-cyan-400"
                              : service.status === "degraded"
                              ? "text-amber-400"
                              : "text-red-400"
                          }`}
                        />
                      ) : (
                        <Cloud
                          className={`w-4 h-4 ${
                            service.status === "healthy"
                              ? "text-cyan-400"
                              : service.status === "degraded"
                              ? "text-amber-400"
                              : "text-red-400"
                          }`}
                        />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-200">{service.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Uptime: {service.uptime}</div>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      service.status === "healthy"
                        ? "bg-cyan-500/20 text-cyan-400"
                        : service.status === "degraded"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {service.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-gray-500 mb-1">Latency</div>
                    <div className="text-gray-300 font-medium">{service.latency}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Requests</div>
                    <div className="text-gray-300 font-medium">{service.requests}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Card className="bg-gray-900 border-gray-800">
          <CollapsibleTrigger asChild>
            <button className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-800/50 transition-colors">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-400" />
                <h3 className="text-gray-300">System Configuration</h3>
              </div>
              {settingsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-6 grid grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-400">Monitoring</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
                    onClick={() => openConfig(configSections.alerts)}
                  >
                    Configure Alerts
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
                    onClick={() => openConfig(configSections.thresholds)}
                  >
                    Metric Thresholds
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
                    onClick={() => openConfig(configSections.retention)}
                  >
                    Data Retention
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-400">Performance</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
                    onClick={() => openConfig(configSections.autoscaling)}
                  >
                    Auto-Scaling
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
                    onClick={() => openConfig(configSections.loadbalancing)}
                  >
                    Load Balancing
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
                    onClick={() => openConfig(configSections.cache)}
                  >
                    Cache Settings
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-400">Maintenance</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
                    onClick={() => openConfig(configSections.backup)}
                  >
                    Backup Schedule
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
                    onClick={() => openConfig(configSections.update)}
                  >
                    Update Policy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
                    onClick={() => openConfig(configSections.maintenance)}
                  >
                    Maintenance Window
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog
        open={configOpen}
        onOpenChange={(open) => {
          setConfigOpen(open);
          if (!open) {
            setConfigSection(null);
            setConfigStatus({ saving: false, error: "", saved: "" });
          }
        }}
      >
        <DialogContent className="bg-gray-900 border border-gray-800 text-gray-100">
          <DialogHeader>
            <DialogTitle>{configSection?.title || "System Configuration"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {configSection?.description || "Update operational configuration for this environment."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {configSection?.key === "alerts" && (
              <>
                <ToggleField
                  label="Continuous Monitoring"
                  description="Keep behavioral telemetry always-on with live anomaly scoring."
                  value={configForm.continuousMonitoring}
                  onChange={(value) => updateForm("continuousMonitoring", value)}
                />
                <ToggleField
                  label="MITRE ATT&CK Mapping"
                  description="Automatically enrich alerts with MITRE technique IDs."
                  value={configForm.mitreMapping}
                  onChange={(value) => updateForm("mitreMapping", value)}
                />
              </>
            )}

            {configSection?.key === "thresholds" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400">Low Risk Threshold</label>
                  <Input
                    type="number"
                    value={configForm.lowRisk}
                    onChange={(event) => updateForm("lowRisk", event.target.value)}
                    className="mt-2 bg-gray-800 border-gray-700 text-gray-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Medium Risk Threshold</label>
                  <Input
                    type="number"
                    value={configForm.mediumRisk}
                    onChange={(event) => updateForm("mediumRisk", event.target.value)}
                    className="mt-2 bg-gray-800 border-gray-700 text-gray-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">High Risk Threshold</label>
                  <Input
                    type="number"
                    value={configForm.highRisk}
                    onChange={(event) => updateForm("highRisk", event.target.value)}
                    className="mt-2 bg-gray-800 border-gray-700 text-gray-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Session Monitor Interval (sec)</label>
                  <Input
                    type="number"
                    value={configForm.sessionInterval}
                    onChange={(event) => updateForm("sessionInterval", event.target.value)}
                    className="mt-2 bg-gray-800 border-gray-700 text-gray-200"
                  />
                </div>
              </div>
            )}

            {configSection?.key === "retention" && (
              <div>
                <label className="text-xs text-gray-400">Data Retention (days)</label>
                <Input
                  type="number"
                  value={configForm.dataRetentionDays}
                  onChange={(event) => updateForm("dataRetentionDays", event.target.value)}
                  className="mt-2 bg-gray-800 border-gray-700 text-gray-200"
                />
              </div>
            )}

            {configSection?.key === "autoscaling" && (
              <ToggleField
                label="Auto-Scaling"
                description="Automatically add capacity when load increases."
                value={configForm.autoScaling}
                onChange={(value) => updateForm("autoScaling", value)}
              />
            )}

            {configSection?.key === "loadbalancing" && (
              <ToggleField
                label="Load Balancing"
                description="Distribute incoming traffic across available nodes."
                value={configForm.loadBalancing}
                onChange={(value) => updateForm("loadBalancing", value)}
              />
            )}

            {configSection?.key === "cache" && (
              <div>
                <label className="text-xs text-gray-400">Cache TTL (minutes)</label>
                <Input
                  type="number"
                  value={configForm.cacheTtl}
                  onChange={(event) => updateForm("cacheTtl", event.target.value)}
                  className="mt-2 bg-gray-800 border-gray-700 text-gray-200"
                />
              </div>
            )}

            {configSection?.key === "backup" && (
              <div>
                <label className="text-xs text-gray-400">Backup Schedule</label>
                <Input
                  value={configForm.backupSchedule}
                  onChange={(event) => updateForm("backupSchedule", event.target.value)}
                  className="mt-2 bg-gray-800 border-gray-700 text-gray-200"
                />
              </div>
            )}

            {configSection?.key === "update" && (
              <ToggleField
                label="Auto Update Policy"
                description="Enable scheduled patching and security updates."
                value={configForm.updatePolicy}
                onChange={(value) => updateForm("updatePolicy", value)}
              />
            )}

            {configSection?.key === "maintenance" && (
              <div>
                <label className="text-xs text-gray-400">Maintenance Window</label>
                <Input
                  value={configForm.maintenanceWindow}
                  onChange={(event) => updateForm("maintenanceWindow", event.target.value)}
                  className="mt-2 bg-gray-800 border-gray-700 text-gray-200"
                />
              </div>
            )}
          </div>

          {configStatus.error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {configStatus.error}
            </div>
          )}
          {configStatus.saved && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300">
              {configStatus.saved}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
              onClick={() => setConfigOpen(false)}
            >
              Close
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleSave}
              disabled={configStatus.saving}
            >
              {configStatus.saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
