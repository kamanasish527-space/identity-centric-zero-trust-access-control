import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClient, clearAuth } from "../api/client";
import { getFingerprint, getStoredLocation } from "../utils";
import { isAdminRole, isAnalystRole, normalizeRole } from "../utils/roles";

const defaultWsUrl =
  window.location.protocol === "https:"
    ? `wss://${window.location.host}/ws/events`
    : `ws://${window.location.host}/ws/events`;
const configuredWsUrl = import.meta.env.VITE_WS_URL;
const WS_URL = configuredWsUrl
  ? configuredWsUrl.startsWith("ws://") || configuredWsUrl.startsWith("wss://")
    ? configuredWsUrl
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}${configuredWsUrl}`
  : defaultWsUrl;

export function useDashboardData(role) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(null);
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [riskAnalytics, setRiskAnalytics] = useState({
    trend: [],
    decision_breakdown: [],
    mitre_techniques: [],
  });
  const [threatIntel, setThreatIntel] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [systemArchitectureHealth, setSystemArchitectureHealth] = useState(null);
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [sessionAlert, setSessionAlert] = useState("");
  const [liveRisk, setLiveRisk] = useState({
    totalRisk: 0,
    anomalyScore: 0,
    factors: {
      loginTime: 0,
      ipChange: 0,
      deviceChange: 0,
      sessionPattern: 0,
    },
    insight: null,
  });
  const [simulation, setSimulation] = useState({
    active: false,
    running: false,
    riskOverride: null,
    alertMessage: "",
    sessionTerminated: false,
    terminationReason: "",
    behaviors: [],
    factors: null,
    mitre: [],
    pulseSeed: 0,
  });

  const effectiveRole = normalizeRole(role);
  const isAdmin = isAdminRole(effectiveRole);
  const isAnalyst = isAnalystRole(effectiveRole);

  const playAlertTone = useCallback(() => {
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }

      const ctx = new AudioContextCtor();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const frequencies = [880, 640, 920];
      frequencies.forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = index === 1 ? "triangle" : "sawtooth";
        oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + index * 0.14);

        gainNode.gain.setValueAtTime(0.0001, ctx.currentTime + index * 0.14);
        gainNode.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + index * 0.14 + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.14 + 0.11);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start(ctx.currentTime + index * 0.14);
        oscillator.stop(ctx.currentTime + index * 0.14 + 0.12);
      });

      window.setTimeout(() => {
        ctx.close();
      }, 1000);
    } catch {
      // Audio is optional for simulation mode.
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError("");

      const requests = [
        apiClient.get("/dashboard/overview"),
        apiClient.get("/dashboard/profile"),
        apiClient.get("/dashboard/logs?limit=120"),
        apiClient.get("/dashboard/risk-analytics?hours=72"),
        apiClient.get("/dashboard/threat-intel?limit=30"),
        apiClient.get(isAdmin || isAnalyst ? "/sessions/active?all_users=true" : "/sessions/active"),
        apiClient.get("/dashboard/system-health"),
        apiClient.get("/risk/live"),
      ];

      if (isAdmin || isAnalyst) {
        requests.push(apiClient.get("/settings"));
      }
      if (isAdmin || isAnalyst) {
        requests.push(apiClient.get("/admin/users"));
      }

      const responses = await Promise.all(requests);

      setOverview(responses[0].data);
      setProfile(responses[1].data);
      setLogs(responses[2].data);
      setRiskAnalytics(responses[3].data);
      setThreatIntel(responses[4].data);
      setSessions(responses[5].data);
      setSystemArchitectureHealth(responses[6].data);
      setLiveRisk(responses[7].data);

      let idx = 8;
      if (isAdmin || isAnalyst) {
        setSettings(responses[idx].data);
        idx += 1;
      }
      if (isAdmin || isAnalyst) {
        setUsers(responses[idx].data);
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        clearAuth();
        window.dispatchEvent(new CustomEvent("zt-auth-expired"));
        setError("Session expired. Please sign in again.");
      } else {
        setError(err?.response?.data?.error?.message || "Failed to load dashboard data");
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isAnalyst]);

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(fetchData, 15000);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const pollSystemHealth = async () => {
      try {
        const response = await apiClient.get("/dashboard/system-health");
        setSystemArchitectureHealth(response.data);
      } catch {
        // Ignore temporary polling errors.
      }
    };

    pollSystemHealth();
    const interval = window.setInterval(pollSystemHealth, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const pollLiveRisk = async () => {
      try {
        const response = await apiClient.get("/risk/live");
        setLiveRisk(response.data);
      } catch {
        // Ignore temporary polling errors.
      }
    };

    pollLiveRisk();
    const interval = window.setInterval(pollLiveRisk, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const monitorInterval = settings?.session_monitor_interval_seconds || 20;

    const runHeartbeat = async () => {
      try {
        const response = await apiClient.post("/sessions/heartbeat", {
          device_fingerprint: getFingerprint(),
          location: getStoredLocation(),
          protocol: "https",
        });

        if (!response.data.is_active) {
          setSessionAlert(response.data.termination_reason || "Session terminated by policy engine");
        } else {
          setSessionAlert("");
        }
      } catch {
        // heartbeat can fail briefly during refresh; polling loop recovers
      }
    };

    runHeartbeat();
    const interval = window.setInterval(runHeartbeat, monitorInterval * 1000);
    return () => window.clearInterval(interval);
  }, [settings?.session_monitor_interval_seconds]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    const pingInterval = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 20000);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "audit_event" && message.payload) {
          setLogs((prev) => [message.payload, ...prev].slice(0, 150));

          if (message.payload.risk_level && ["medium", "high", "critical"].includes(message.payload.risk_level)) {
            const severity =
              message.payload.risk_level === "critical"
                ? "critical"
                : message.payload.risk_level === "high"
                ? "high"
                : "warning";

            setThreatIntel((prev) => [
              {
                timestamp: message.payload.timestamp,
                severity,
                risk_level: message.payload.risk_level,
                technique_id: message.payload.mitre_technique_id,
                technique_name: message.payload.mitre_technique_name,
                tactic: message.payload.mitre_tactic,
                summary: message.payload.message,
              },
              ...prev,
            ].slice(0, 40));
          }
        }
      } catch {
        // Ignore malformed event payloads.
      }
    };

    return () => {
      window.clearInterval(pingInterval);
      ws.close();
    };
  }, []);

  const lockUser = useCallback(
    async (userId) => {
      await apiClient.post(`/admin/users/${userId}/lock`);
      await fetchData();
    },
    [fetchData]
  );

  const unlockUser = useCallback(
    async (userId) => {
      await apiClient.post(`/admin/users/${userId}/unlock`);
      await fetchData();
    },
    [fetchData]
  );

  const saveSettings = useCallback(
    async (payload) => {
      const response = await apiClient.put("/settings", payload);
      setSettings(response.data);
      await fetchData();
    },
    [fetchData]
  );

  const exportLogs = useCallback(async () => {
    const response = await apiClient.get("/admin/logs/export?days=7", { responseType: "blob" });
    const blob = new Blob([response.data], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit_logs.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  }, []);

  const runAttackSimulation = useCallback(async () => {
    if (!isAdmin) {
      setError("Only admin role can trigger attack simulation");
      return;
    }
    setSimulation((prev) => ({ ...prev, running: true }));
    try {
      setError("");
      const response = await apiClient.post("/risk/simulate-attack", {});
      const payload = response.data;

      setSimulation((prev) => ({
        ...prev,
        active: true,
        running: false,
        riskOverride: Number(payload.totalRisk || 0),
        alertMessage: payload.activityMessage || "Attack Simulation Mode active",
        sessionTerminated: Boolean(payload.sessionTerminated),
        terminationReason: payload.terminationReason || "",
        behaviors: payload.simulatedBehaviors || [],
        factors: payload.factors || null,
        mitre: payload.mitre || [],
        pulseSeed: prev.pulseSeed + 1,
      }));

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              current_risk_score: Number(payload.totalRisk || prev.current_risk_score || 0),
              current_risk_level: payload.riskLevel || prev.current_risk_level || "high",
            }
          : prev
      );
      setLiveRisk((prev) => ({
        ...prev,
        totalRisk: Number(payload.totalRisk || 0),
        anomalyScore: Number(payload.anomalyScore || prev.anomalyScore || 0),
        factors: payload.factors || prev.factors,
      }));

      if (payload.sessionTerminated) {
        setSessionAlert(payload.terminationReason || "Access Denied - High Risk");
      }

      playAlertTone();
      await fetchData();
    } catch (err) {
      setSimulation((prev) => ({ ...prev, running: false }));
      setError(err?.response?.data?.error?.message || "Failed to run attack simulation");
    }
  }, [fetchData, isAdmin, playAlertTone]);

  const resetAttackSimulation = useCallback(async () => {
    if (!isAdmin) {
      setError("Only admin role can reset attack simulation");
      return;
    }
    setSimulation((prev) => ({ ...prev, running: true }));
    try {
      setError("");
      const response = await apiClient.post("/risk/simulation/reset", {});
      const payload = response.data;

      setSimulation((prev) => ({
        ...prev,
        active: false,
        running: false,
        riskOverride: null,
        alertMessage: "",
        sessionTerminated: false,
        terminationReason: "",
        behaviors: [],
        factors: null,
        mitre: [],
        pulseSeed: prev.pulseSeed + 1,
      }));

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              current_risk_score: Number(payload.totalRisk || 0),
              current_risk_level: payload.riskLevel || "low",
            }
          : prev
      );
      setLiveRisk((prev) => ({
        ...prev,
        totalRisk: Number(payload.totalRisk || 0),
        anomalyScore: 0,
      }));

      setSessionAlert("");
      await fetchData();
    } catch (err) {
      setSimulation((prev) => ({ ...prev, running: false }));
      setError(err?.response?.data?.error?.message || "Failed to reset attack simulation");
    }
  }, [fetchData, isAdmin]);

  const zeroTrustScore = useMemo(() => {
    const risk = Number(profile?.current_risk_score || 0);
    return Math.max(0, Math.min(100, Math.round(100 - risk)));
  }, [profile?.current_risk_score]);

  return {
    loading,
    error,
    overview,
    profile,
    logs,
    riskAnalytics,
    threatIntel,
    sessions,
    systemArchitectureHealth,
    liveRisk,
    settings,
    users,
    sessionAlert,
    simulation,
    zeroTrustScore,
    actions: {
      fetchData,
      lockUser,
      unlockUser,
      saveSettings,
      exportLogs,
      runAttackSimulation,
      resetAttackSimulation,
    },
  };
}




