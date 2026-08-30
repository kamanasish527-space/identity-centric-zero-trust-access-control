import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SIMULATION_STEPS = [
  {
    id: "init",
    title: "Simulation initialized",
    description: "Target production replica environment spun up for attack testing.",
    type: "info",
    mitre: "T1595",
    tactic: "Reconnaissance",
    riskDelta: 2,
  },
  {
    id: "recon",
    title: "Initial reconnaissance scan",
    description: "Port scanning detected across 192.168.1.0/24 with elevated probe frequency.",
    type: "warning",
    mitre: "T1046",
    tactic: "Discovery",
    riskDelta: 6,
  },
  {
    id: "brute",
    title: "Brute force attack initiated",
    description: "1,000+ failed authentication attempts observed against privileged accounts.",
    type: "critical",
    mitre: "T1110",
    tactic: "Credential Access",
    riskDelta: 12,
  },
  {
    id: "detect",
    title: "Intrusion detection activated",
    description: "Behavioral model flagged anomalous access patterns and blocked source IPs.",
    type: "success",
    mitre: "T1562",
    tactic: "Defense Evasion",
    riskDelta: -6,
  },
  {
    id: "lateral",
    title: "Lateral movement attempt",
    description: "Suspicious remote service usage detected across internal segments.",
    type: "warning",
    mitre: "T1021",
    tactic: "Lateral Movement",
    riskDelta: 7,
  },
  {
    id: "exfil",
    title: "Potential data exfiltration",
    description: "Outbound transfer volume spike detected outside normal business hours.",
    type: "critical",
    mitre: "T1041",
    tactic: "Exfiltration",
    riskDelta: 10,
  },
  {
    id: "contain",
    title: "Containment measures deployed",
    description: "Suspicious sessions isolated and adaptive policy controls reinforced.",
    type: "success",
    mitre: "T1565",
    tactic: "Response",
    riskDelta: -8,
  },
  {
    id: "cleanup",
    title: "Post-incident cleanup",
    description: "Baseline security posture restored and telemetry normalized.",
    type: "info",
    mitre: "T1070",
    tactic: "Defense Evasion",
    riskDelta: -4,
  },
];

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function severityFromType(type) {
  if (type === "critical") return "critical";
  if (type === "warning") return "high";
  if (type === "success") return "low";
  return "info";
}

function riskLevelFromScore(score) {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function buildLog(event, riskScore) {
  const severity = severityFromType(event.type);
  const ipSuffix = Math.floor(20 + Math.random() * 180);
  return {
    id: `sim-${event.id}-${event.index}`,
    timestamp: event.timestamp,
    username: "simulation",
    user_id: "sim-engine",
    action: event.title,
    ip_address: `203.0.113.${ipSuffix}`,
    location: "Simulation",
    resource: "/simulation",
    risk_level: severity === "info" ? "low" : severity,
    risk_score: riskScore,
    decision: severity === "critical" ? "deny" : "monitor",
    event_type: "simulation",
    message: event.description,
    mitre_technique_id: event.mitre,
    mitre_technique_name: event.title,
    mitre_tactic: event.tactic,
  };
}

function buildAlert(event) {
  const severity = severityFromType(event.type);
  if (severity === "info") return null;
  return {
    timestamp: event.timestamp,
    severity: severity === "high" ? "high" : severity === "critical" ? "critical" : "warning",
    technique_id: event.mitre,
    technique_name: event.title,
    tactic: event.tactic,
    summary: event.description,
  };
}

function seedSessions(baselineRisk) {
  const seed = Math.max(40, baselineRisk);
  return [
    {
      session_id: "sim-2847",
      username: "unknown",
      location: "Unknown",
      ip_address: "203.45.12.9",
      device_fingerprint: "SIM-DEVICE-1",
      issued_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      actions_count: 12,
      risk_score: clamp(seed + 8, 0, 100),
      risk_level: riskLevelFromScore(seed + 8),
      is_active: true,
      simulated: true,
    },
    {
      session_id: "sim-2846",
      username: "john.doe@corp.io",
      location: "London, UK",
      ip_address: "192.168.1.67",
      device_fingerprint: "SIM-DEVICE-2",
      issued_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
      actions_count: 89,
      risk_score: clamp(seed - 6, 0, 100),
      risk_level: riskLevelFromScore(seed - 6),
      is_active: true,
      simulated: true,
    },
    {
      session_id: "sim-2845",
      username: "alice.wang@corp.io",
      location: "Singapore, SG",
      ip_address: "172.16.0.88",
      device_fingerprint: "SIM-DEVICE-3",
      issued_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      actions_count: 156,
      risk_score: clamp(seed + 3, 0, 100),
      risk_level: riskLevelFromScore(seed + 3),
      is_active: true,
      simulated: true,
    },
  ];
}

function updateSessionsForEvent(sessions, event, riskScore) {
  let updated = sessions.map((session) => ({
    ...session,
    risk_score: clamp(session.risk_score + (event.type === "critical" ? 6 : event.type === "warning" ? 3 : 0), 0, 100),
  }));

  updated = updated.map((session) => ({
    ...session,
    risk_level: riskLevelFromScore(session.risk_score),
  }));

  if (event.type === "critical") {
    const activeIndex = updated.findIndex((session) => session.is_active);
    if (activeIndex >= 0) {
      updated = updated.map((session, idx) =>
        idx === activeIndex
          ? {
              ...session,
              is_active: false,
              termination_reason: "Terminated during simulation response",
            }
          : session
      );
    }
  }

  updated = updated.map((session) => ({
    ...session,
    risk_score: clamp(session.risk_score + Math.round((riskScore - 50) * 0.05), 0, 100),
    risk_level: riskLevelFromScore(session.risk_score),
  }));

  return updated;
}

function computeOutcome(events, riskScore) {
  const criticalCount = events.filter((event) => event.type === "critical").length;
  const successCount = events.filter((event) => event.type === "success").length;
  const blocked = criticalCount === 0 || successCount >= criticalCount;
  const label = blocked && riskScore < 85 ? "All Threats Neutralized" : "Access Blocked";
  const grade =
    riskScore <= 35 ? "A+" :
    riskScore <= 55 ? "A" :
    riskScore <= 75 ? "B" : "C";

  return {
    label,
    grade,
    blocked,
    criticalCount,
  };
}

export function useSimulationEngine({ baseRisk = 45, onBackendStart, onBackendReset } = {}) {
  const [baselineRisk, setBaselineRisk] = useState(() => clamp(baseRisk, 0, 100));
  const [state, setState] = useState(() => ({
    status: "idle",
    progress: 0,
    events: [],
    riskScore: clamp(baseRisk, 0, 100),
    logs: [],
    alerts: [],
    sessions: [],
    sessionAlert: "",
    outcome: null,
    lastUpdated: null,
  }));

  const statusRef = useRef(state.status);

  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  useEffect(() => {
    if (state.status === "idle" && state.events.length === 0) {
      const nextBaseline = clamp(baseRisk, 0, 100);
      setBaselineRisk(nextBaseline);
      setState((prev) => ({
        ...prev,
        riskScore: nextBaseline,
      }));
    }
  }, [baseRisk, state.events.length, state.status]);

  useEffect(() => {
    if (state.status !== "running") {
      return undefined;
    }
    if (state.events.length >= SIMULATION_STEPS.length) {
      return undefined;
    }

    const delay = 1000 + Math.random() * 1000;
    const timer = window.setTimeout(() => {
      setState((prev) => {
        if (prev.status !== "running") {
          return prev;
        }
        const nextIndex = prev.events.length;
        const template = SIMULATION_STEPS[nextIndex];
        if (!template) {
          const outcome = computeOutcome(prev.events, prev.riskScore);
          return {
            ...prev,
            status: "completed",
            progress: 100,
            outcome,
            lastUpdated: new Date().toISOString(),
          };
        }

        const jitter = Math.round((Math.random() - 0.5) * 4);
        const nextRisk = clamp(prev.riskScore + template.riskDelta + jitter, 0, 100);
        const timestamp = new Date().toISOString();
        const event = {
          ...template,
          index: nextIndex + 1,
          timestamp,
          riskScore: nextRisk,
        };

        const nextEvents = [...prev.events, event];
        const log = buildLog(event, nextRisk);
        const alert = buildAlert(event);
        const nextLogs = [log, ...prev.logs].slice(0, 120);
        const nextAlerts = alert ? [alert, ...prev.alerts].slice(0, 40) : prev.alerts;
        const nextSessions = prev.sessions.length === 0
          ? updateSessionsForEvent(seedSessions(baselineRisk), event, nextRisk)
          : updateSessionsForEvent(prev.sessions, event, nextRisk);

        const progress = Math.min(100, Math.round((nextEvents.length / SIMULATION_STEPS.length) * 100));
        const nextStatus = nextEvents.length >= SIMULATION_STEPS.length ? "completed" : "running";
        const outcome = nextStatus === "completed" ? computeOutcome(nextEvents, nextRisk) : prev.outcome;

        const sessionAlert = nextSessions.find((session) => !session.is_active)
          ? "Simulated session terminated during response"
          : prev.sessionAlert;

        return {
          ...prev,
          status: nextStatus,
          progress,
          events: nextEvents,
          riskScore: nextRisk,
          logs: nextLogs,
          alerts: nextAlerts,
          sessions: nextSessions,
          sessionAlert,
          outcome,
          lastUpdated: timestamp,
        };
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [baselineRisk, state.events.length, state.status]);

  const start = useCallback(async () => {
    if (statusRef.current === "running") {
      return;
    }

    if (onBackendStart) {
      try {
        await onBackendStart();
      } catch {
        // backend simulation is optional
      }
    }

    setState((prev) => ({
      ...prev,
      status: "running",
      riskScore: prev.events.length === 0 ? baselineRisk : prev.riskScore,
      sessions: prev.sessions.length === 0 ? seedSessions(baselineRisk) : prev.sessions,
      sessionAlert: "",
      outcome: null,
      lastUpdated: new Date().toISOString(),
    }));
  }, [baselineRisk, onBackendStart]);

  const stop = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: "idle",
      outcome: prev.outcome || { label: "Stopped", grade: "-", blocked: false },
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  const reset = useCallback(async () => {
    if (onBackendReset) {
      try {
        await onBackendReset();
      } catch {
        // backend reset is optional
      }
    }

    setState({
      status: "idle",
      progress: 0,
      events: [],
      riskScore: baselineRisk,
      logs: [],
      alerts: [],
      sessions: [],
      sessionAlert: "",
      outcome: null,
      lastUpdated: new Date().toISOString(),
    });
  }, [baselineRisk, onBackendReset]);

  const terminateSession = useCallback((sessionId) => {
    if (!sessionId) return;
    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((session) =>
        session.session_id === sessionId
          ? { ...session, is_active: false, termination_reason: "Terminated by operator" }
          : session
      ),
      sessionAlert: "Operator terminated a simulated session",
    }));
  }, []);

  const computed = useMemo(() => {
    const paused = state.status === "idle" && state.events.length > 0;
    return {
      ...state,
      paused,
      totalSteps: SIMULATION_STEPS.length,
    };
  }, [state]);

  return {
    state: computed,
    start,
    stop,
    reset,
    terminateSession,
  };
}
