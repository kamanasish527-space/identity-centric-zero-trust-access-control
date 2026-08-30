import { useMemo, useState } from "react";
import { Icon } from "./Icons";

function statusLabel(status) {
  if (status === "degraded") return "System Degraded";
  if (status === "monitoring") return "System Monitoring";
  return "All Systems Operational";
}

export default function Header({ systemStatus = "operational", notifications = [], onLogout }) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const label = useMemo(() => statusLabel(systemStatus), [systemStatus]);
  const displayNotifications = notifications.slice(0, 5);

  return (
    <header className="cw-topbar">
      <span className={`system-pill ${systemStatus}`}>
        <span className="status-dot" />
        {label}
      </span>
      <button
        type="button"
        className="icon-btn"
        onClick={() => {
          setAlertsOpen((prev) => !prev);
          setSettingsOpen(false);
        }}
        aria-label="Notifications"
        style={{ position: 'relative' }}
      >
        <Icon name="bell" size={18} />
        {notifications.length > 0 && <span className="notif-badge" />}
      </button>
      {alertsOpen && (
        <div className="dropdown-panel">
          <div className="dropdown-header">
            <strong>Security Alerts</strong>
          </div>
          {displayNotifications.length === 0 ? (
            <p className="dropdown-empty">No active alerts</p>
          ) : (
            <ul>
              {displayNotifications.map((item, index) => (
                <li key={`${item.timestamp}-${index}`}>
                  <span className={`pill ${item.severity || "warning"}`}>{item.severity || "warning"}</span>
                  <div>
                    <strong>{item.technique_id || "Threat Signal"}</strong>
                    <small>{item.summary}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        type="button"
        className="icon-btn"
        onClick={() => {
          setSettingsOpen((prev) => !prev);
          setAlertsOpen(false);
        }}
        aria-label="Settings"
        style={{ position: 'relative' }}
      >
        <Icon name="gear" size={18} />
      </button>
      {settingsOpen && (
        <div className="dropdown-panel">
          <div className="dropdown-header">
            <strong>Operator Controls</strong>
          </div>
          <button type="button" className="dropdown-action" onClick={onLogout}>Sign out</button>
        </div>
      )}
    </header>
  );
}
