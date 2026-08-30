import AnimatedCounter from "./AnimatedCounter";
import { floatHourToClock, formatTimestamp } from "../utils/time";
import { roleLabel } from "../utils/roles";

function getDecisionMeta(decision) {
  const normalized = (decision || "allow").toLowerCase();

  if (normalized === "deny") {
    return {
      label: "DENY",
      subtitle: "Access denied due to high behavioral risk",
      className: "deny",
    };
  }

  if (normalized === "step_up") {
    return {
      label: "STEP-UP",
      subtitle: "Additional verification required",
      className: "step-up",
    };
  }

  if (normalized === "lock_and_alert" || normalized === "lock") {
    return {
      label: "CRITICAL LOCK",
      subtitle: "Account locked and SOC alert triggered",
      className: "critical",
    };
  }

  return {
    label: "ALLOW",
    subtitle: "Access granted and identity verified",
    className: "allow",
  };
}

export default function SecuritySnapshot({ user, profile, sessions, logs, zeroTrustScore }) {
  const latestLog = logs?.[0];
  const meta = getDecisionMeta(latestLog?.decision);

  const currentRisk = Number(profile?.current_risk_score || 0);
  const sessionStatus = sessions?.some((item) => item.is_active) ? "ACTIVE" : "TERMINATED";
  const knownLocation = profile?.known_locations?.[0] || "Unverified";
  const knownDevice = profile?.known_device_fingerprints?.[0] || "Unknown";
  const accessFreq = Number(profile?.access_frequency_per_day || 1);
  const freqLow = Math.max(1, Math.floor(accessFreq * 0.7));
  const freqHigh = Math.max(freqLow + 1, Math.ceil(accessFreq * 1.3));

  return (
    <section className="panel snapshot-panel">
      <div className={`snapshot-hero snapshot-${meta.className}`}>
        <div className="snapshot-status-dot" />
        <p>Access Analysis Result</p>
        <h3>{meta.label}</h3>
        <span>{meta.subtitle}</span>
        <small>{formatTimestamp(latestLog?.timestamp)}</small>
      </div>

      <div className="snapshot-grid">
        <article className="card snapshot-card snapshot-risk">
          <div className="card-head">
            <h4>Risk Score</h4>
            <span className="metric-unit">/100</span>
          </div>
          <div className="metric-value">
            <AnimatedCounter value={currentRisk} decimals={0} />
          </div>
          <div className="snapshot-progress">
            <span style={{ width: `${Math.max(4, Math.min(100, 100 - currentRisk))}%` }} />
          </div>
        </article>

        <article className="card snapshot-card">
          <div className="card-head">
            <h4>👤 Username</h4>
          </div>
          <div className="metric-value">{user?.username || "N/A"}</div>
          <small>Role: {roleLabel(user?.role)}</small>
        </article>

        <article className="card snapshot-card">
          <div className="card-head">
            <h4>🔄 Session Status</h4>
          </div>
          <div className="metric-value">{sessionStatus}</div>
          <small>
            Active sessions: <AnimatedCounter value={sessions?.filter((item) => item.is_active).length || 0} decimals={0} />
          </small>
        </article>

        <article className="card snapshot-card">
          <div className="card-head">
            <h4>🕒 Access Time</h4>
          </div>
          <div className="metric-value">{formatTimestamp(latestLog?.timestamp)}</div>
          <small>Local timezone rendering</small>
        </article>

        <article className="card snapshot-card">
          <div className="card-head">
            <h4>⏰ Avg Login Hour</h4>
          </div>
          <div className="metric-value">{floatHourToClock(profile?.average_login_hour || 0)}</div>
          <small>Deviation baseline aware</small>
        </article>

        <article className="card snapshot-card">
          <div className="card-head">
            <h4>📍 Known Location</h4>
          </div>
          <div className="metric-value">{knownLocation}</div>
          <small>Continuously re-validated</small>
        </article>

        <article className="card snapshot-card">
          <div className="card-head">
            <h4>💻 Known Device</h4>
          </div>
          <div className="metric-value">{knownDevice}</div>
          <small>Fingerprint verified</small>
        </article>

        <article className="card snapshot-card snapshot-trust">
          <div className="card-head">
            <h4>🛡️ Trust Score</h4>
            <span className="metric-unit">/100</span>
          </div>
          <div className="metric-value">
            <AnimatedCounter value={zeroTrustScore} decimals={0} />
          </div>
          <small>{freqLow}-{freqHigh} accesses/day expected</small>
        </article>
      </div>
    </section>
  );
}


