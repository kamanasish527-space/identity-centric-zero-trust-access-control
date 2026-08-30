import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, Bell, Settings } from "lucide-react";

import { Button } from "../ui/button";

function statusLabel(status) {
  if (status === "degraded") return "System Degraded";
  if (status === "monitoring") return "System Monitoring";
  return "All Systems Operational";
}

function statusDot(status) {
  if (status === "degraded") return "bg-red-500";
  if (status === "monitoring") return "bg-amber-400";
  return "bg-cyan-400";
}

export default function DashboardLayout({ navItems = [], systemStatus = "operational", notifications = [], onLogout, children }) {
  const location = useLocation();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const label = useMemo(() => statusLabel(systemStatus), [systemStatus]);
  const badgeColor = useMemo(() => statusDot(systemStatus), [systemStatus]);
  const displayNotifications = notifications.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-100">CyberWatch Analytics</h1>
                <p className="text-xs text-gray-500">Enterprise Security Platform</p>
              </div>
            </div>

            <div className="flex items-center gap-3 relative">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
                <div className={`w-1.5 h-1.5 rounded-full ${badgeColor} animate-pulse`} />
                <span className="text-xs text-gray-400">{label}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
                onClick={() => {
                  setAlertsOpen((prev) => !prev);
                  setSettingsOpen(false);
                }}
              >
                <Bell className="w-4 h-4" />
              </Button>
              {notifications.length > 0 && (
                <span className="absolute right-[86px] top-1.5 h-2 w-2 rounded-full bg-red-500" />
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
                onClick={() => {
                  setSettingsOpen((prev) => !prev);
                  setAlertsOpen(false);
                }}
              >
                <Settings className="w-4 h-4" />
              </Button>

              {alertsOpen && (
                <div className="absolute right-10 top-10 w-80 rounded-lg border border-gray-800 bg-gray-900 shadow-lg">
                  <div className="px-4 py-3 border-b border-gray-800 text-sm text-gray-300">Security Alerts</div>
                  {displayNotifications.length === 0 ? (
                    <div className="px-4 py-4 text-xs text-gray-500">No active alerts</div>
                  ) : (
                    <ul className="max-h-72 overflow-auto">
                      {displayNotifications.map((item, index) => (
                        <li key={`${item.timestamp}-${index}`} className="px-4 py-3 border-b border-gray-800 last:border-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded ${
                                item.severity === "critical"
                                  ? "bg-red-500/20 text-red-400"
                                  : item.severity === "high"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-cyan-500/20 text-cyan-400"
                              }`}
                            >
                              {item.severity || "warning"}
                            </span>
                            <span className="text-xs text-gray-400">{item.technique_id || "Threat Signal"}</span>
                          </div>
                          <p className="text-xs text-gray-500">{item.summary}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {settingsOpen && (
                <div className="absolute right-0 top-10 w-48 rounded-lg border border-gray-800 bg-gray-900 shadow-lg">
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-gray-800"
                    onClick={onLogout}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-56 border-r border-gray-800 bg-gray-900/30 min-h-[calc(100vh-57px)] sticky top-[57px] overflow-y-auto">
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                      : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6 max-w-[calc(100vw-14rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
