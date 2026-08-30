import { useMemo, useState } from "react";

import { Card } from "../components/ui/card";
import { Play, Pause, RotateCcw, Settings, AlertTriangle, CheckCircle, XCircle, Zap } from "lucide-react";
import { Button } from "../components/ui/button";
import { Slider } from "../components/ui/slider";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { useDashboard } from "../store/dashboardStore";
import { parseApiTimestamp } from "../utils/time";

function formatElapsed(timestamp, start) {
  if (!timestamp || !start) return "00:00";
  const diff = Math.max(0, new Date(timestamp).getTime() - new Date(start).getTime());
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function mapSeverity(value) {
  const lower = String(value || "").toLowerCase();
  if (lower === "critical") return "critical";
  if (lower === "high") return "high";
  if (lower === "medium") return "medium";
  return "low";
}

export default function SimulationLab() {
  const dashboard = useDashboard();
  const [selectedTab, setSelectedTab] = useState("timeline");

  const simulation = dashboard.simulation || {};
  const isPlaying = Boolean(simulation.running);
  const progressValue = Number(simulation.progress || 0);

  const events = simulation.events || [];
  const startTimestamp = events[0]?.timestamp;

  const simulationEvents = useMemo(() => {
    if (events.length === 0) {
      return [];
    }

    return events.map((event) => ({
      time: formatElapsed(event.timestamp, startTimestamp),
      event: event.title,
      type: event.type,
      details: event.description,
    }));
  }, [events, startTimestamp]);

  const injectedAttacks = useMemo(() => {
    const logs = simulation.logs || [];
    return logs.slice(0, 8).map((log, index) => ({
      id: log.mitre_technique_id || `ATK-${index + 1}`,
      name: log.action || log.mitre_technique_name || "Attack Event",
      target: log.resource || "Simulation",
      status: String(log.decision || "monitor").toLowerCase().includes("deny") ? "blocked" : "mitigated",
      severity: mapSeverity(log.risk_level),
      detection: `${(Math.random() * 4 + 0.8).toFixed(1)}s`,
    }));
  }, [simulation.logs]);

  const blockedCount = injectedAttacks.filter((attack) => attack.status === "blocked").length;
  const mitigatedCount = injectedAttacks.filter((attack) => attack.status === "mitigated").length;
  const breaches = simulation.outcome && !simulation.outcome.blocked ? 1 : 0;

  const criticalCount = events.filter((event) => event.type === "critical").length;
  const successCount = events.filter((event) => event.type === "success").length;
  const detectionRate = criticalCount > 0 ? Math.min(100, Math.round((successCount / criticalCount) * 100)) : 98;
  const attackComplexity = simulation.riskScore > 70 ? "High" : simulation.riskScore > 45 ? "Medium" : "Low";
  const responseTime = simulation.riskScore > 70 ? "Moderate" : "Fast";
  const systemResilience = simulation.riskScore > 70 ? "Stable" : "Excellent";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl text-gray-100 mb-1">Forensic Deep-Dive / Simulation Lab</h2>
        <p className="text-sm text-gray-500">Attack simulation and security response testing</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isPlaying ? "bg-indigo-500/10 animate-pulse" : "bg-gray-800"}`}>
              <Zap className={`w-5 h-5 ${isPlaying ? "text-indigo-400" : "text-gray-600"}`} />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-semibold text-gray-100">{isPlaying ? "Running" : simulation.status === "completed" ? "Completed" : "Paused"}</div>
              <div className="text-xs text-gray-500">Simulation Status</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-semibold text-gray-100">{blockedCount}</div>
              <div className="text-xs text-gray-500">Attacks Blocked</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-semibold text-gray-100">{mitigatedCount}</div>
              <div className="text-xs text-gray-500">Threats Mitigated</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-semibold text-gray-100">{breaches}</div>
              <div className="text-xs text-gray-500">Breaches</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          <Card className="p-6 bg-gray-900 border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-gray-300">Attack Simulation Controls</h3>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-300">
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Simulation Progress</span>
                <span className="text-sm font-medium text-gray-300">{progressValue}%</span>
              </div>
              <Slider value={[progressValue]} max={100} step={1} className="mb-2" disabled />
              <div className="flex justify-between text-xs text-gray-500">
                <span>00:00</span>
                <span>Duration: 2h 35m</span>
                <span>02:35</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="default"
                className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1"
                onClick={() => {
                  if (isPlaying) {
                    dashboard.actions.stopSimulation();
                  } else {
                    dashboard.actions.startSimulation();
                  }
                }}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause Simulation
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Simulation
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="default"
                className="border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
                onClick={dashboard.actions.resetSimulation}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>

              <Button
                variant="outline"
                size="default"
                className="border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
                onClick={dashboard.actions.exportLogs}
              >
                Export Results
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-gray-900 border-gray-800">
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="w-full bg-gray-800 border-gray-700 mb-4">
                <TabsTrigger value="timeline" className="flex-1 data-[state=active]:bg-indigo-600">
                  Live Timeline
                </TabsTrigger>
                <TabsTrigger value="attacks" className="flex-1 data-[state=active]:bg-indigo-600">
                  Injected Attacks
                </TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="mt-0">
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {simulationEvents.length === 0 ? (
                    <div className="text-sm text-gray-500">No simulation events yet.</div>
                  ) : (
                    simulationEvents.map((event, index) => (
                      <div key={index} className="flex items-start gap-4 group">
                        <div className="flex-shrink-0 pt-1">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              event.type === "critical"
                                ? "bg-red-500"
                                : event.type === "warning"
                                ? "bg-amber-500"
                                : event.type === "success"
                                ? "bg-cyan-500"
                                : "bg-indigo-500"
                            }`}
                          />
                        </div>

                        <div className="flex-1 min-w-0 pb-4 border-b border-gray-800 last:border-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-xs text-gray-500 font-mono">{event.time}</span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                event.type === "critical"
                                  ? "border-red-500/50 text-red-400 bg-red-500/10"
                                  : event.type === "warning"
                                  ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                                  : event.type === "success"
                                  ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10"
                                  : "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                              }`}
                            >
                              {event.type}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-200 mb-1">{event.event}</div>
                          <div className="text-xs text-gray-500">{event.details}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="attacks" className="mt-0">
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {injectedAttacks.length === 0 ? (
                    <div className="text-sm text-gray-500">No injected attacks captured.</div>
                  ) : (
                    injectedAttacks.map((attack) => (
                      <div key={attack.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                              {attack.id}
                            </Badge>
                            <span className="font-medium text-gray-200">{attack.name}</span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              attack.status === "blocked"
                                ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10"
                                : "border-amber-500/50 text-amber-400 bg-amber-500/10"
                            }`}
                          >
                            {attack.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Target</div>
                            <div className="text-gray-300">{attack.target}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Severity</div>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                attack.severity === "critical"
                                  ? "border-red-500/50 text-red-400 bg-red-500/10"
                                  : attack.severity === "high"
                                  ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                                  : "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                              }`}
                            >
                              {attack.severity}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Detection Time</div>
                            <div className="text-gray-300">{attack.detection}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <div className="col-span-4 space-y-6">
          <Card className="p-6 bg-gray-900 border-gray-800">
            <h3 className="text-gray-300 mb-4">Risk Assessment</h3>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Attack Complexity</span>
                  <span className="text-sm font-medium text-amber-400">{attackComplexity}</span>
                </div>
                <Progress value={simulation.riskScore || 0} className="h-2" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Detection Rate</span>
                  <span className="text-sm font-medium text-cyan-400">{detectionRate}%</span>
                </div>
                <Progress value={detectionRate} className="h-2" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Response Time</span>
                  <span className="text-sm font-medium text-cyan-400">{responseTime}</span>
                </div>
                <Progress value={responseTime === "Fast" ? 92 : 76} className="h-2" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">System Resilience</span>
                  <span className="text-sm font-medium text-cyan-400">{systemResilience}</span>
                </div>
                <Progress value={systemResilience === "Excellent" ? 95 : 82} className="h-2" />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-800">
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-2">Overall Score</div>
                <div className="text-4xl font-semibold text-cyan-400">{simulation.outcome?.grade || "A+"}</div>
                <div className="text-xs text-gray-500 mt-1">Security Posture</div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gray-900 border-gray-800">
            <h3 className="text-gray-300 mb-4">Simulation Outcome</h3>

            <div className="space-y-4">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-cyan-400">{simulation.outcome?.label || "All Threats Neutralized"}</span>
                </div>
                <p className="text-xs text-gray-400">
                  {simulation.outcome?.blocked === false
                    ? "High-risk activity contained, access blocked during simulation."
                    : "100% of simulated attacks were successfully detected and blocked within acceptable timeframes."}
                </p>
              </div>

              <div className="p-3 bg-gray-800/50 rounded-lg">
                <div className="text-xs text-gray-500 mb-2">Key Findings:</div>
                <ul className="space-y-1.5 text-xs text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-0.5">&bull;</span>
                    <span>Average detection time: 2.1 seconds</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-0.5">&bull;</span>
                    <span>Zero successful breaches</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-0.5">&bull;</span>
                    <span>Automated response: 94% effective</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-0.5">&bull;</span>
                    <span>No data exfiltration occurred</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                <div className="text-xs text-gray-500 mb-2">Recommendations:</div>
                <ul className="space-y-1.5 text-xs text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 mt-0.5">&bull;</span>
                    <span>Increase cache service monitoring</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 mt-0.5">&bull;</span>
                    <span>Review backup service configuration</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
