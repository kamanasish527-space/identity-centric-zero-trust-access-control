import { useMemo, useState } from "react";
import AnimatedCounter from "./AnimatedCounter";
import { formatTimestamp } from "../utils/time";
import { Icon } from "./layout/Icons";

export default function SessionMonitorCard({ sessions, alert, onRefresh, onTerminate }) {
  const [filter, setFilter] = useState("all");
  const active = sessions.filter((item) => item.is_active);

  const filtered = useMemo(() => {
    if (filter === "high") {
      return sessions.filter((item) => ["high", "critical"].includes(String(item.risk_level || "").toLowerCase()));
    }
    if (filter === "active") {
      return sessions.filter((item) => item.is_active);
    }
    return sessions;
  }, [filter, sessions]);

  return (
    <section className="card session-card">
      <div className="card-head">
        <h3>Session Monitor</h3>
        <div className="session-actions">
          <span className="chip">Active: <AnimatedCounter value={active.length} decimals={0} /></span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Filter</option>
            <option value="active">Active</option>
            <option value="high">High Risk</option>
          </select>
          <button type="button" className="ghost-btn" onClick={onRefresh}>Refresh</button>
        </div>
      </div>

      {alert && <div className="alert-banner">Session terminated: {alert}</div>}

      <div className="session-list">
        {filtered.slice(0, 8).map((item) => {
          const riskLevel = String(item.risk_level || "low").toLowerCase();
          const issuedAt = item.issued_at ? new Date(item.issued_at) : null;
          const minutes = issuedAt ? Math.max(1, Math.round((Date.now() - issuedAt.getTime()) / 60000)) : 0;

          return (
            <div key={item.session_id || item.id} className="session-row">
              <div className="session-main">
                <span className={`session-dot ${riskLevel}`} />
                <div>
                  <div className="session-title">
                    <strong>{item.username || item.user_id || item.session_id || item.id}</strong>
                    <span className={`pill ${riskLevel}`}>{riskLevel}</span>
                  </div>
                  <div className="session-meta">
                    <span><Icon name="clock" size={12} /> {minutes ? `${minutes}m` : "-"}</span>
                    <span>{item.location || "Unknown"}</span>
                    <span>{item.ip_address || "IP N/A"}</span>
                  </div>
                </div>
              </div>
              <div className="session-side">
                <div>
                  <span>Device</span>
                  <small>{item.device_fingerprint ? "Chrome / MacOS" : "Unknown Device"}</small>
                </div>
                <div>
                  <span>{minutes ? `${minutes}m` : "-"}</span>
                  <small>{item.actions_count ? `${item.actions_count} actions` : "Live session"}</small>
                </div>
                <div className="session-buttons">
                  <button type="button" className="ghost-btn">View Details</button>
                  <button
                    type="button"
                    className="danger-btn"
                    disabled={!item.is_active}
                    onClick={() => onTerminate?.(item)}
                  >
                    Terminate
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
