export default function SimulationOutcome({ outcome, criticalAlerts, sessionTerminated }) {
  const label = outcome?.label || "All Threats Neutralized";

  return (
    <article className="card sim-outcome-card">
      <div className="card-head">
        <h3>Simulation Outcome</h3>
      </div>
      <div className="sim-outcome-banner">
        <strong>{label}</strong>
        <p>Threat sequence handled by adaptive policy controls.</p>
      </div>
      <div className="sim-outcome-section">
        <h4>Key Findings</h4>
        <ul>
          <li>Average detection time: {Math.max(1, Math.round(8 - (criticalAlerts || 0) / 2))} seconds</li>
          <li>Escalated alerts: {criticalAlerts}</li>
          <li>Session termination: {sessionTerminated ? "Yes" : "No"}</li>
        </ul>
      </div>
      <div className="sim-outcome-section">
        <h4>Recommendations</h4>
        <ul>
          <li>Increase cache service monitoring.</li>
          <li>Review backup service configuration.</li>
        </ul>
      </div>
    </article>
  );
}
