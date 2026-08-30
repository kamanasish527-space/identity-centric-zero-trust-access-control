import { useMemo, useState } from "react";

const MATRIX_COLUMNS = [
  {
    tactic: "Initial Access",
    techniques: [
      {
        id: "T1566",
        name: "Phishing",
        summary: "Social engineering used to gain initial foothold.",
        mitigation: "Enforce phishing-resistant MFA and tighten email/web filtering controls.",
      },
    ],
  },
  {
    tactic: "Credential Access",
    techniques: [
      {
        id: "T1110",
        name: "Brute Force",
        summary: "Repeated authentication attempts to guess credentials.",
        mitigation: "Throttle attempts, lock suspicious accounts, and require step-up verification.",
      },
      {
        id: "TA0006",
        name: "Credential Access",
        summary: "Adversary objective focused on obtaining valid account credentials.",
        mitigation: "Reset impacted credentials, increase anomaly thresholds, and monitor identity abuse.",
      },
    ],
  },
  {
    tactic: "Persistence",
    techniques: [
      {
        id: "T1078",
        name: "Valid Accounts",
        summary: "Use of legitimate credentials for unauthorized access.",
        mitigation: "Verify identity context and revoke risky sessions using adaptive policy controls.",
      },
    ],
  },
  {
    tactic: "Discovery",
    techniques: [
      {
        id: "T1046",
        name: "Network Service Discovery",
        summary: "Unusual probing patterns to discover exposed services.",
        mitigation: "Limit service exposure and alert on scanning-like traffic behavior.",
      },
    ],
  },
  {
    tactic: "Lateral Movement",
    techniques: [
      {
        id: "T1021",
        name: "Remote Services",
        summary: "Use of remote service channels for lateral access.",
        mitigation: "Restrict remote service paths and enforce least privilege across identities.",
      },
    ],
  },
  {
    tactic: "Command and Control",
    techniques: [
      {
        id: "T1071",
        name: "Application Layer Protocol",
        summary: "Suspicious use of normal application protocols for covert control.",
        mitigation: "Inspect protocol deviations and isolate abnormal client behavior.",
      },
    ],
  },
];

function mapTechniqueHits(logs, mitreTechniques) {
  const counts = new Map();
  (mitreTechniques || []).forEach((row) => {
    counts.set(row.technique_id, Number(row.count || 0));
  });

  (logs || []).forEach((row) => {
    const id = row?.mitre_technique_id;
    if (!id) {
      return;
    }
    counts.set(id, (counts.get(id) || 0) + 1);
  });

  const credentialAccessSignals =
    (counts.get("T1110") || 0) +
    (counts.get("T1078") || 0) +
    (logs || []).filter((row) => String(row?.event_type || "").includes("AUTH_")).length;
  counts.set("TA0006", credentialAccessSignals);
  return counts;
}

function getDetectionReason({ techniqueId, hitCount, latestLogMessage, simulationActive }) {
  if (simulationActive && techniqueId === "T1110") {
    return "Detected from five rapid failed authentication attempts injected during attack simulation.";
  }
  if (simulationActive && techniqueId === "T1078") {
    return "Detected from valid credential usage on a foreign IP with mismatched device fingerprint.";
  }
  if (simulationActive && techniqueId === "TA0006") {
    return "Credential Access objective flagged from combined brute-force and valid-account abuse indicators.";
  }

  if (hitCount > 0 && latestLogMessage) {
    return `Correlated from ${hitCount} telemetry events. Latest signal: "${latestLogMessage}".`;
  }
  if (hitCount > 0) {
    return `Correlated from ${hitCount} telemetry events in recent SOC stream.`;
  }
  return "No strong signal yet. Technique remains monitored by behavioral analytics.";
}

export default function MitreTechniqueMatrix({
  mitreTechniques,
  logs,
  simulationActive = false,
  simulationMitre = [],
}) {
  const [selected, setSelected] = useState(null);

  const hitCounts = useMemo(() => mapTechniqueHits(logs, mitreTechniques), [logs, mitreTechniques]);

  const simulationIds = useMemo(() => {
    const ids = new Set((simulationMitre || []).map((item) => item.technique_id));
    if (simulationActive) {
      ids.add("T1110");
      ids.add("T1078");
      ids.add("TA0006");
    }
    return ids;
  }, [simulationActive, simulationMitre]);

  const activeTactics = useMemo(() => {
    const out = new Set();
    MATRIX_COLUMNS.forEach((column) => {
      const hasActive = column.techniques.some((tech) => (hitCounts.get(tech.id) || 0) > 0 || simulationIds.has(tech.id));
      if (hasActive || (simulationActive && column.tactic === "Credential Access")) {
        out.add(column.tactic);
      }
    });
    return out;
  }, [hitCounts, simulationIds, simulationActive]);

  const openTechnique = (technique, tactic) => {
    const hitCount = hitCounts.get(technique.id) || 0;
    const latestLog = (logs || []).find((row) => row?.mitre_technique_id === technique.id);
    setSelected({
      ...technique,
      tactic,
      hitCount,
      detection: getDetectionReason({
        techniqueId: technique.id,
        hitCount,
        latestLogMessage: latestLog?.message,
        simulationActive,
      }),
    });
  };

  return (
    <article className="chart-card mitre-matrix-card">
      <div className="chart-card-head">
        <h4>MITRE ATT&CK Technique Matrix</h4>
        <span className="chip">Interactive</span>
      </div>

      <div className="mitre-matrix-grid">
        {MATRIX_COLUMNS.map((column) => (
          <section key={column.tactic} className="mitre-tactic-column">
            <header className={`mitre-tactic-head ${activeTactics.has(column.tactic) ? "active" : ""}`}>
              <span>{column.tactic}</span>
            </header>
            <div className="mitre-technique-list">
              {column.techniques.map((technique) => {
                const hitCount = hitCounts.get(technique.id) || 0;
                const isActive = hitCount > 0 || simulationIds.has(technique.id);
                return (
                  <button
                    key={technique.id}
                    type="button"
                    className={`mitre-technique-cell ${isActive ? "active" : ""}`}
                    onClick={() => openTechnique(technique, column.tactic)}
                  >
                    <strong>{technique.id}</strong>
                    <span>{technique.name}</span>
                    <small>{isActive ? `${hitCount} detections` : "Monitoring"}</small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {selected && (
        <>
          <button type="button" className="mitre-sidepanel-backdrop" onClick={() => setSelected(null)} />
          <aside className="mitre-sidepanel">
            <div className="mitre-sidepanel-head">
              <h4>
                {selected.id} - {selected.name}
              </h4>
              <button type="button" className="icon-btn" onClick={() => setSelected(null)}>
                x
              </button>
            </div>
            <div className="mitre-sidepanel-body">
              <p>
                <strong>What It Means:</strong> {selected.summary}
              </p>
              <p>
                <strong>How System Detected It:</strong> {selected.detection}
              </p>
              <p>
                <strong>Mitigation Strategy:</strong> {selected.mitigation}
              </p>
              <div className="mitre-sidepanel-meta">
                <span>Tactic: {selected.tactic}</span>
                <span>Signals: {selected.hitCount}</span>
              </div>
            </div>
          </aside>
        </>
      )}
    </article>
  );
}
