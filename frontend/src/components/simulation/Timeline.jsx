import { useMemo } from "react";
import { Icon } from "../layout/Icons";
import { formatTimestamp } from "../../utils/time";

function severityBadge(type) {
  if (type === "critical") return "critical";
  if (type === "warning") return "high";
  if (type === "success") return "low";
  return "info";
}

export default function SimulationTimeline({ events, logs, view, onViewChange, phase }) {
  const attackRows = useMemo(
    () => logs.filter((log) => String(log.event_type || "").includes("simulation")),
    [logs]
  );

  return (
    <article className="card sim-timeline-card">
      <div className="sim-tabs">
        <button
          type="button"
          className={`tab-btn ${view === "timeline" ? "active" : ""}`}
          onClick={() => onViewChange("timeline")}
        >
          Live Timeline
        </button>
        <button
          type="button"
          className={`tab-btn ${view === "attacks" ? "active" : ""}`}
          onClick={() => onViewChange("attacks")}
        >
          Injected Attacks
        </button>
        <span className="chip">{phase}</span>
      </div>

      <div className="timeline-list">
        {view === "timeline" && (
          events.length === 0 ? (
            <div className="empty-state">No simulation events yet.</div>
          ) : (
            events.map((event, index) => (
              <div key={`${event.id}-${index}`} className="timeline-item">
                <div className="timeline-left">
                  <span className={`timeline-dot ${event.type}`} />
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.description}</p>
                    <small>{formatTimestamp(event.timestamp)}</small>
                  </div>
                </div>
                <span className={`pill ${severityBadge(event.type)}`}>{event.type}</span>
              </div>
            ))
          )
        )}

        {view === "attacks" && (
          attackRows.length === 0 ? (
            <div className="empty-state">No injected attacks yet.</div>
          ) : (
            attackRows.map((log, index) => {
              const severity = String(log.risk_level || "info");
              return (
                <div key={`${log.id}-${index}`} className="timeline-item">
                  <div className="timeline-left">
                    <span className={`timeline-dot ${severity}`} />
                    <div>
                      <strong>{log.mitre_technique_name || log.action || "Injected attack"}</strong>
                      <p>{log.message || "Simulation event captured"}</p>
                      <small>{formatTimestamp(log.timestamp)}</small>
                    </div>
                  </div>
                  <span className={`pill ${severity}`}>{severity}</span>
                </div>
              );
            })
          )
        )}
      </div>
    </article>
  );
}
