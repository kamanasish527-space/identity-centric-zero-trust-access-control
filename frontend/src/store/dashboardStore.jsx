import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiClient } from "../api/client";
import { useDashboardData } from "../hooks/useDashboardData";
import { useSimulationEngine } from "./simulationEngine";

const DashboardContext = createContext(null);

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function mergeSessions(simSessions, baseSessions) {
  const map = new Map();
  (simSessions || []).forEach((session) => {
    const key = session.session_id || session.id;
    if (key) {
      map.set(key, session);
    }
  });
  (baseSessions || []).forEach((session) => {
    const key = session.session_id || session.id;
    if (!map.has(key)) {
      map.set(key, session);
    }
  });
  return Array.from(map.values());
}

function buildSimulationFactors(events, riskScore) {
  if (!events || events.length === 0) {
    return null;
  }
  const critical = events.filter((event) => event.type === "critical").length;
  const warning = events.filter((event) => event.type === "warning").length;
  const success = events.filter((event) => event.type === "success").length;
  return {
    ipChange: clamp(30 + warning * 8 + critical * 10 - success * 4, 0, 100),
    deviceChange: clamp(25 + critical * 9 - success * 5, 0, 100),
    loginTime: clamp(20 + warning * 7 + Math.round(riskScore / 4), 0, 100),
    sessionPattern: clamp(20 + warning * 4 + critical * 6 - success * 3, 0, 100),
  };
}

export function DashboardProvider({ role, children }) {
  const base = useDashboardData(role);
  const simulationEngine = useSimulationEngine({
    baseRisk: base.liveRisk?.totalRisk ?? base.profile?.current_risk_score ?? 45,
    onBackendStart: base.actions?.runAttackSimulation,
    onBackendReset: base.actions?.resetAttackSimulation,
  });

  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!base.systemArchitectureHealth) {
      return;
    }

    setMetrics({
      apiLatency: Number(base.systemArchitectureHealth.api_latency_ms || 45),
      cpuUsage: Number(base.systemArchitectureHealth.cpu_usage_percent || 68),
      memoryUsage: Number(base.systemArchitectureHealth.memory_usage_percent || 62),
      uptime: Number(base.systemArchitectureHealth.uptime_percent || 99.8),
    });
  }, [base.systemArchitectureHealth]);

  useEffect(() => {
    if (!metrics) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setMetrics((prev) => {
        if (!prev) return prev;
        return {
          apiLatency: clamp(prev.apiLatency + (Math.random() - 0.5) * 6, 28, 140),
          cpuUsage: clamp(prev.cpuUsage + (Math.random() - 0.5) * 4, 20, 98),
          memoryUsage: clamp(prev.memoryUsage + (Math.random() - 0.5) * 3.5, 30, 98),
          uptime: clamp(prev.uptime + (Math.random() - 0.5) * 0.2, 95, 99.99),
        };
      });
    }, 4000);

    return () => window.clearInterval(interval);
  }, [metrics]);

  const simulationState = simulationEngine.state;

  const simulationFactors = useMemo(
    () => buildSimulationFactors(simulationState.events, simulationState.riskScore),
    [simulationState.events, simulationState.riskScore]
  );

  const simulationMitre = useMemo(
    () =>
      (simulationState.events || []).map((event) => ({
        technique_id: event.mitre,
        technique_name: event.title,
        tactic: event.tactic,
      })),
    [simulationState.events]
  );

  const combinedLogs = useMemo(
    () => [...(simulationState.logs || []), ...(base.logs || [])],
    [base.logs, simulationState.logs]
  );

  const combinedThreatIntel = useMemo(() => {
    const alerts = [...(simulationState.alerts || []), ...(base.threatIntel || [])];
    return alerts.sort((a, b) => {
      const aTime = new Date(a.timestamp || 0).getTime();
      const bTime = new Date(b.timestamp || 0).getTime();
      return bTime - aTime;
    });
  }, [base.threatIntel, simulationState.alerts]);

  const combinedSessions = useMemo(
    () => mergeSessions(simulationState.sessions || [], base.sessions || []),
    [base.sessions, simulationState.sessions]
  );

  const effectiveRiskScore = useMemo(() => {
    if (simulationState.events.length > 0 || simulationState.status !== "idle") {
      return simulationState.riskScore;
    }
    return (
      base.simulation?.riskOverride ??
      base.liveRisk?.totalRisk ??
      base.profile?.current_risk_score ??
      0
    );
  }, [base.liveRisk?.totalRisk, base.profile?.current_risk_score, base.simulation?.riskOverride, simulationState]);

  const terminateSession = useCallback(
    async (session) => {
      if (!session) return;
      if (session.simulated) {
        simulationEngine.terminateSession(session.session_id);
        return;
      }

      if (!session.session_id) return;
      await apiClient.post(`/sessions/terminate/${session.session_id}`);
      await base.actions.fetchData();
    },
    [base.actions, simulationEngine]
  );

  const value = useMemo(
    () => ({
      ...base,
      logs: combinedLogs,
      threatIntel: combinedThreatIntel,
      sessions: combinedSessions,
      simulation: {
        status: simulationState.status,
        progress: simulationState.progress,
        events: simulationState.events,
        riskScore: simulationState.riskScore,
        logs: simulationState.logs,
        sessionAlert: simulationState.sessionAlert || base.sessionAlert,
        outcome: simulationState.outcome,
        paused: simulationState.paused,
        running: simulationState.status === "running",
        factors: simulationFactors,
        mitre: simulationMitre,
        pulseSeed: simulationState.events.length,
      },
      metrics: metrics || {
        apiLatency: 45,
        cpuUsage: 68,
        memoryUsage: 62,
        uptime: 99.8,
      },
      effectiveRiskScore,
      actions: {
        ...base.actions,
        startSimulation: simulationEngine.start,
        stopSimulation: simulationEngine.stop,
        resetSimulation: simulationEngine.reset,
        terminateSession,
      },
    }),
    [
      base,
      combinedLogs,
      combinedSessions,
      combinedThreatIntel,
      effectiveRiskScore,
      metrics,
      simulationEngine.reset,
      simulationEngine.start,
      simulationEngine.stop,
      simulationEngine.terminateSession,
      simulationFactors,
      simulationMitre,
      simulationState.events.length,
      simulationState.logs,
      simulationState.outcome,
      simulationState.paused,
      simulationState.progress,
      simulationState.riskScore,
      simulationState.sessionAlert,
      simulationState.status,
      terminateSession,
    ]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return ctx;
}
