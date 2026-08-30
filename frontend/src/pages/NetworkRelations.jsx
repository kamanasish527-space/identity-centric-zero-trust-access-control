import { useMemo, useState } from "react";

import { Card } from "../components/ui/card";
import { Globe, Shield, AlertTriangle, Zap, Bug } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useDashboard } from "../store/dashboardStore";
import { parseApiTimestamp } from "../utils/time";

const networkNodes = [
  { x: 15, y: 30, label: "US East", connections: 145, risk: "low" },
  { x: 25, y: 50, label: "US West", connections: 89, risk: "medium" },
  { x: 50, y: 35, label: "EU Central", connections: 234, risk: "low" },
  { x: 70, y: 25, label: "Asia Pacific", connections: 178, risk: "high" },
  { x: 85, y: 55, label: "Australia", connections: 56, risk: "low" },
  { x: 40, y: 70, label: "S. America", connections: 34, risk: "low" },
  { x: 55, y: 15, label: "UK", connections: 198, risk: "medium" },
];

const categoryIcons = {
  vulnerability: Bug,
  network: Zap,
  malware: AlertTriangle,
  phishing: Shield,
};

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

function mapCategory(alert) {
  const text = `${alert.tactic || ""} ${alert.technique_name || ""}`.toLowerCase();
  if (text.includes("phish")) return "phishing";
  if (text.includes("credential") || text.includes("account")) return "network";
  if (text.includes("malware") || text.includes("ransom")) return "malware";
  return "vulnerability";
}

export default function NetworkRelations() {
  const dashboard = useDashboard();
  const [selectedTab, setSelectedTab] = useState("map");

  const threats = useMemo(() => {
    const base = (dashboard.threatIntel || []).slice(0, 10).map((item, index) => ({
      id: item.technique_id || `TI-${index + 1}`,
      title: item.summary || item.technique_name || "Threat telemetry signal",
      severity: item.severity || "medium",
      source: item.technique_id || "MITRE",
      time: timeAgo(item.timestamp),
      category: mapCategory(item),
    }));

    return base.length > 0 ? base : [];
  }, [dashboard.threatIntel]);

  const mitreTactics = useMemo(() => {
    const techniques = dashboard.riskAnalytics?.mitre_techniques || [];
    if (techniques.length === 0) return [];

    const map = new Map();
    techniques.forEach((tech) => {
      const tactic = tech.tactic || "Unknown";
      if (!map.has(tactic)) {
        map.set(tactic, []);
      }
      map.get(tactic).push(tech.technique_name || tech.technique_id || "Technique");
    });

    const colors = ["#ef4444", "#f59e0b", "#eab308", "#84cc16", "#06b6d4", "#6366f1", "#8b5cf6", "#ec4899"];

    return Array.from(map.entries()).map(([phase, techniquesList], index) => ({
      phase,
      techniques: techniquesList.slice(0, 6),
      count: techniquesList.length,
      color: colors[index % colors.length],
    }));
  }, [dashboard.riskAnalytics?.mitre_techniques]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl text-gray-100 mb-1">Network & Relations</h2>
        <p className="text-sm text-gray-500">Global infrastructure monitoring and threat mapping</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          <Card className="p-6 bg-gray-900 border-gray-800">
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-300">Global Network View</h3>
                <TabsList className="bg-gray-800 border-gray-700">
                  <TabsTrigger value="map" className="data-[state=active]:bg-indigo-600">
                    <Globe className="w-3.5 h-3.5 mr-1.5" />
                    Map View
                  </TabsTrigger>
                  <TabsTrigger value="mitre" className="data-[state=active]:bg-indigo-600">
                    <Shield className="w-3.5 h-3.5 mr-1.5" />
                    MITRE ATT&CK
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="map" className="mt-0">
                <div className="relative h-96 bg-gray-950/50 rounded-lg border border-gray-800 overflow-hidden">
                  <svg className="w-full h-full" viewBox="0 0 1000 400">
                    <g opacity="0.3">
                      <line x1="150" y1="120" x2="500" y2="140" stroke="#6366f1" strokeWidth="1" strokeDasharray="4 2" />
                      <line x1="250" y1="200" x2="500" y2="140" stroke="#6366f1" strokeWidth="1" strokeDasharray="4 2" />
                      <line x1="500" y1="140" x2="700" y2="100" stroke="#6366f1" strokeWidth="1" strokeDasharray="4 2" />
                      <line x1="700" y1="100" x2="850" y2="220" stroke="#6366f1" strokeWidth="1" strokeDasharray="4 2" />
                      <line x1="500" y1="140" x2="550" y2="60" stroke="#6366f1" strokeWidth="1" strokeDasharray="4 2" />
                      <line x1="400" y1="280" x2="500" y2="140" stroke="#6366f1" strokeWidth="1" strokeDasharray="4 2" />
                    </g>

                    {networkNodes.map((node, i) => {
                      const x = (node.x / 100) * 1000;
                      const y = (node.y / 100) * 400;
                      const color = node.risk === "high" ? "#ef4444" : node.risk === "medium" ? "#f59e0b" : "#06b6d4";

                      return (
                        <g key={i}>
                          <circle cx={x} cy={y} r="25" fill={color} opacity="0.1">
                            <animate attributeName="r" from="15" to="30" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.3" to="0" dur="2s" repeatCount="indefinite" />
                          </circle>
                          <circle cx={x} cy={y} r="15" fill={color} opacity="0.8" />
                          <text x={x} y={y + 35} fill="#9ca3af" fontSize="12" textAnchor="middle">
                            {node.label}
                          </text>
                          <text x={x} y={y + 50} fill="#6b7280" fontSize="10" textAnchor="middle">
                            {node.connections} connections
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="flex items-center justify-center gap-6 mt-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-500" />
                    <span className="text-gray-400">Low Risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-gray-400">Medium Risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-gray-400">High Risk</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="mitre" className="mt-0">
                {mitreTactics.length === 0 ? (
                  <div className="text-sm text-gray-500">No MITRE telemetry available.</div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {mitreTactics.map((tactic, index) => (
                      <div key={index} className="p-4 bg-gray-800/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-1 h-8 rounded" style={{ backgroundColor: tactic.color }} />
                            <div>
                              <span className="font-medium text-gray-200">{tactic.phase}</span>
                              <div className="text-xs text-gray-500 mt-0.5">MITRE ATT&CK Tactic</div>
                            </div>
                          </div>
                          <span className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded font-medium">
                            {tactic.count} detected
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {tactic.techniques.map((tech, idx) => (
                            <span key={idx} className="text-xs bg-gray-900 text-gray-400 px-3 py-1.5 rounded border border-gray-700 hover:border-gray-600 transition-colors">
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <div className="col-span-4">
          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-300">Threat Intelligence</h3>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                <span className="text-xs text-gray-500">Live Feed</span>
              </div>
            </div>

            <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
              {threats.length === 0 ? (
                <div className="text-sm text-gray-500">No threat telemetry available.</div>
              ) : (
                threats.map((threat) => {
                  const Icon = categoryIcons[threat.category];

                  return (
                    <div
                      key={threat.id}
                      className="p-3 bg-gray-800/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex-shrink-0 p-1.5 rounded ${
                            threat.severity === "critical"
                              ? "bg-red-500/20"
                              : threat.severity === "high"
                              ? "bg-amber-500/20"
                              : "bg-cyan-500/20"
                          }`}
                        >
                          <Icon
                            className={`w-3.5 h-3.5 ${
                              threat.severity === "critical"
                                ? "text-red-400"
                                : threat.severity === "high"
                                ? "text-amber-400"
                                : "text-cyan-400"
                            }`}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-300 mb-2 line-clamp-2">{threat.title}</div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-gray-500">#{threat.id}</span>
                            <span className="text-gray-600">&bull;</span>
                            <span className="text-gray-500">{threat.source}</span>
                            <span
                              className={`px-2 py-0.5 rounded ${
                                threat.severity === "critical"
                                  ? "bg-red-500/20 text-red-400"
                                  : threat.severity === "high"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-cyan-500/20 text-cyan-400"
                              }`}
                            >
                              {threat.severity}
                            </span>
                          </div>

                          <div className="text-xs text-gray-600 mt-2">{threat.time}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
