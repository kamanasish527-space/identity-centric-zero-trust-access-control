import { useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Activity, Database, FlaskConical, LayoutDashboard, Network, TrendingUp, Users } from "lucide-react";

import DashboardLoadingSkeleton from "../components/DashboardLoadingSkeleton";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { DashboardProvider, useDashboard } from "../store/dashboardStore";
import { normalizeRole } from "../utils/roles";
import { parseApiTimestamp } from "../utils/time";

const NAV_ITEMS = [
  { to: "/", label: "Executive Overview", icon: LayoutDashboard },
  { to: "/data-details", label: "Data Details", icon: Database },
  { to: "/predictive-risk", label: "Predictive & Risk", icon: TrendingUp },
  { to: "/behavioral", label: "Behavioral Analysis", icon: Users },
  { to: "/network", label: "Network & Relations", icon: Network },
  { to: "/intelligence", label: "Actionable Intelligence", icon: Activity },
  { to: "/simulation", label: "Simulation Lab", icon: FlaskConical, adminOnly: true },
];

const ACTIVE_ALERT_WINDOW_MS = 20 * 60 * 1000;

function isElevatedSeverity(value) {
  return ["medium", "high", "critical", "warning"].includes(String(value || "").toLowerCase());
}

function isActiveAlert(alert, nowMs) {
  if (!isElevatedSeverity(alert?.severity)) {
    return false;
  }

  const parsed = parseApiTimestamp(alert?.timestamp);
  if (!parsed) {
    return true;
  }

  return nowMs - parsed.getTime() <= ACTIVE_ALERT_WINDOW_MS;
}

function computeSystemStatus({ riskScore, activeAlertsCount, hasCriticalAlert, serviceHealth, simulationRunning }) {
  let status = "operational";
  if (riskScore > 70 || hasCriticalAlert) {
    status = "degraded";
  } else if (riskScore >= 40 && riskScore <= 70) {
    status = "monitoring";
  } else if (riskScore < 40 && activeAlertsCount === 0) {
    status = "operational";
  } else {
    status = "monitoring";
  }

  if (serviceHealth === "red") {
    status = "degraded";
  } else if (serviceHealth === "yellow" && status === "operational") {
    status = "monitoring";
  }

  if (simulationRunning && status === "operational") {
    status = "monitoring";
  }

  return status;
}

function ShellContent({ user, role, onLogout }) {
  const dashboard = useDashboard();
  const navigate = useNavigate();

  const nowMs = Date.now();
  const threatAlerts = (dashboard.threatIntel || []).filter((item) => isActiveAlert(item, nowMs));
  const serviceHealth = String(dashboard.systemArchitectureHealth?.overall_status || "green").toLowerCase();
  const simulationRunning = Boolean(dashboard.simulation?.running || dashboard.simulation?.status === "running");
  const hasCriticalAlert = threatAlerts.some((item) => String(item.severity || "").toLowerCase() === "critical");
  const activeAlertsCount = threatAlerts.length + (simulationRunning ? 1 : 0);

  const systemStatus = computeSystemStatus({
    riskScore: Number(dashboard.effectiveRiskScore || 0),
    activeAlertsCount,
    hasCriticalAlert,
    serviceHealth,
    simulationRunning,
  });

  const notifications = useMemo(() => {
    return threatAlerts.slice(0, 8).map((item) => ({
      timestamp: item.timestamp,
      technique_id: item.technique_id,
      summary: item.summary || item.technique_name || "Threat telemetry signal detected",
      severity: item.severity,
    }));
  }, [threatAlerts]);

  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");

  return (
    <DashboardLayout
      navItems={navItems}
      systemStatus={systemStatus}
      notifications={notifications}
      onLogout={async () => {
        await onLogout();
        navigate("/login");
      }}
    >
      {dashboard.loading ? (
        <DashboardLoadingSkeleton />
      ) : (
        <>
          {dashboard.error && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {dashboard.error}
            </div>
          )}
          <Outlet />
        </>
      )}
    </DashboardLayout>
  );
}

export default function SocShellPage() {
  const { user, logout } = useAuth();
  const role = normalizeRole(user?.role);

  return (
    <DashboardProvider role={role}>
      <ShellContent user={user} role={role} onLogout={logout} />
    </DashboardProvider>
  );
}
