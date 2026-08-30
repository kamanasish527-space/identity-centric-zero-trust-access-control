import { useMemo, useState } from "react";

import { Card } from "../components/ui/card";
import { Users, AlertTriangle, XCircle, Activity, MapPin, Clock, Monitor, Copy } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useDashboard } from "../store/dashboardStore";
import { parseApiTimestamp } from "../utils/time";

function formatDuration(issuedAt) {
  const started = parseApiTimestamp(issuedAt);
  if (!started) return "-";
  const diff = Math.max(0, Date.now() - started.getTime());
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining}m`;
  return `${hours}h ${remaining}m`;
}

function resolveRiskLevel(session) {
  const explicit = String(session.risk_level || "").toLowerCase();
  if (explicit) return explicit;
  const score = Number(session.risk_score || 0);
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function resolveDevice(session) {
  return session.device || session.device_fingerprint || "Unknown";
}

export default function BehavioralAnalysis() {
  const dashboard = useDashboard();
  const [riskFilter, setRiskFilter] = useState("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailSession, setDetailSession] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const sessions = useMemo(() =>
    (dashboard.sessions || []).map((session) => ({
      ...session,
      risk: resolveRiskLevel(session),
      duration: formatDuration(session.issued_at),
      actions: session.actions_count ?? session.actions ?? 0,
      location: session.location || "Unknown",
      device: resolveDevice(session),
      ip: session.ip_address || "-",
    })),
    [dashboard.sessions]
  );

  const activeSessions = sessions.filter((session) => session.is_active);
  const highRiskSessions = activeSessions.filter((session) => session.risk === "critical" || session.risk === "high");
  const terminatedSessions = sessions.filter((session) => !session.is_active);
  const filteredActiveSessions = activeSessions.filter((session) => {
    if (riskFilter === "all") return true;
    if (riskFilter === "critical") return session.risk === "critical";
    if (riskFilter === "high") return session.risk === "high" || session.risk === "critical";
    if (riskFilter === "medium") return session.risk === "medium";
    if (riskFilter === "low") return session.risk === "low";
    return true;
  });

  const openDetails = (session) => {
    setDetailSession(session);
    setDetailsOpen(true);
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await dashboard.actions.fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl text-gray-100 mb-1">Behavioral Analysis</h2>
        <p className="text-sm text-gray-500">User session monitoring and anomaly detection</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 rounded-lg">
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
            <div className="p-2.5 bg-red-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-semibold text-gray-100">{highRiskSessions.length}</div>
              <div className="text-xs text-gray-500">High-Risk Sessions</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gray-500/10 rounded-lg">
              <XCircle className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-semibold text-gray-100">{terminatedSessions.length}</div>
              <div className="text-xs text-gray-500">Terminated Sessions</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gray-900 border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-lg">
              <Activity className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-semibold text-gray-100">
                {activeSessions.reduce((sum, session) => sum + (session.actions || 0), 0)}
              </div>
              <div className="text-xs text-gray-500">Total Actions (1h)</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-gray-900 border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-gray-400" />
            <h3 className="text-gray-300">Session Monitor</h3>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700">
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-gray-900 border border-gray-700 text-gray-100">
                <DropdownMenuRadioGroup value={riskFilter} onValueChange={setRiskFilter}>
                  <DropdownMenuRadioItem value="all">All Risks</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="critical">Critical</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="high">High</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="medium">Medium</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="low">Low</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {filteredActiveSessions.map((session) => (
            <div
              key={session.session_id || session.id}
              className="p-4 bg-gray-800/50 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 pt-1">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      session.risk === "critical"
                        ? "bg-red-500 animate-pulse"
                        : session.risk === "high"
                        ? "bg-amber-500"
                        : session.risk === "medium"
                        ? "bg-yellow-500"
                        : "bg-cyan-500"
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-medium text-gray-200">{session.username || session.user || "unknown"}</span>
                    <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                      {session.session_id || session.id}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        session.risk === "critical"
                          ? "border-red-500/50 text-red-400 bg-red-500/10"
                          : session.risk === "high"
                          ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                          : session.risk === "medium"
                          ? "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                          : "border-cyan-500/50 text-cyan-400 bg-cyan-500/10"
                      }`}
                    >
                      {session.risk} risk
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{session.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Monitor className="w-3.5 h-3.5" />
                      <span>{session.device}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{session.duration}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Activity className="w-3.5 h-3.5" />
                      <span>{session.actions} actions</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mt-2 font-mono">IP: {session.ip}</div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
                    onClick={() => openDetails(session)}
                  >
                    View Details
                  </Button>
                  {(session.risk === "critical" || session.risk === "high") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500/20"
                      onClick={() => dashboard.actions.terminateSession(session)}
                    >
                      Terminate
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 bg-gray-900 border-gray-800">
        <h3 className="text-gray-300 mb-4">Recently Terminated Sessions</h3>

        <div className="space-y-3">
          {terminatedSessions.length === 0 ? (
            <div className="text-sm text-gray-500">No terminated sessions.</div>
          ) : (
            terminatedSessions.map((session) => (
              <div key={session.session_id || session.id} className="p-3 bg-gray-800/30 rounded-lg border border-gray-800 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <XCircle className="w-4 h-4 text-gray-500" />
                    <div>
                      <div className="text-sm text-gray-400">{session.username || session.user || "unknown"}</div>
                      <div className="text-xs text-gray-500">
                        {session.ip} <span className="mx-1 text-gray-600">&bull;</span> {session.location}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Duration: {session.duration}</span>
                    <span>Actions: {session.actions}</span>
                    <span className="text-gray-600">Terminated</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setDetailSession(null);
        }}
      >
        <DialogContent className="bg-gray-900 border border-gray-700 text-gray-100">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
            <DialogDescription className="text-gray-400">
              Detailed telemetry for the selected session.
            </DialogDescription>
          </DialogHeader>

          {detailSession ? (
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">User</span>
                <span className="font-medium">{detailSession.username || detailSession.user || "unknown"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Session ID</span>
                <span className="font-mono text-xs">{detailSession.session_id || detailSession.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Risk Level</span>
                <span className="capitalize">{detailSession.risk}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Location</span>
                <span>{detailSession.location}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Device</span>
                <span>{detailSession.device}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">IP Address</span>
                <span className="font-mono text-xs">{detailSession.ip}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Duration</span>
                <span>{detailSession.duration}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Actions</span>
                <span>{detailSession.actions}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No session selected.</div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
              onClick={() => {
                if (!detailSession) return;
                navigator.clipboard?.writeText(detailSession.session_id || detailSession.id || "");
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy ID
            </Button>
            {detailSession && (detailSession.risk === "critical" || detailSession.risk === "high") && (
              <Button
                variant="outline"
                size="sm"
                className="border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500/20"
                onClick={() => {
                  dashboard.actions.terminateSession(detailSession);
                  setDetailsOpen(false);
                }}
              >
                Terminate Session
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
