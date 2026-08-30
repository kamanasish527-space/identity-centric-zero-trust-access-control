import AnimatedCounter from "./AnimatedCounter";
import { formatTimestamp } from "../utils/time";

function statusLabel(status) {
  if (status === "red") {
    return "Degraded";
  }
  if (status === "yellow") {
    return "Warning";
  }
  return "Healthy";
}

function meterStatus(value, greenMax, yellowMax) {
  const numeric = Number(value || 0);
  if (numeric <= greenMax) {
    return "green";
  }
  if (numeric <= yellowMax) {
    return "yellow";
  }
  return "red";
}

function ServiceCard({ item }) {
  return (
    <article className="sys-health-service-card">
      <header>
        <span className={`health-dot ${item.status}`} />
        <h4>{item.name}</h4>
        <span className={`health-chip ${item.status}`}>{statusLabel(item.status)}</span>
      </header>
      <p>{item.message}</p>
      {typeof item.latency_ms === "number" && (
        <small>
          Latency: <AnimatedCounter value={item.latency_ms} decimals={1} /> ms
        </small>
      )}
    </article>
  );
}

function TelemetryMeter({ label, value, unit, status }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <article className="sys-health-meter-card">
      <header>
        <h4>{label}</h4>
        <span className={`health-chip ${status}`}>{statusLabel(status)}</span>
      </header>
      <strong>
        <AnimatedCounter value={safeValue} decimals={1} />
        {unit}
      </strong>
      <div className="sys-health-meter-track">
        <span className={`sys-health-meter-fill ${status}`} style={{ width: `${safeValue}%` }} />
      </div>
    </article>
  );
}

export default function SystemArchitectureHealthPanel({ health }) {
  if (!health) {
    return (
      <section id="system-health" className="panel">
        <div className="panel-header">
          <h3>System Architecture & Health</h3>
          <span className="chip">Initializing telemetry...</span>
        </div>
        <div className="skeleton-two-col">
          <div className="skeleton-box" />
          <div className="skeleton-box" />
        </div>
      </section>
    );
  }

  const apiStatus = health.api_latency_status || meterStatus(health.api_latency_ms, 180, 380);
  const cpuStatus = health.cpu_status || meterStatus(health.cpu_usage_percent, 70, 85);
  const memoryStatus = health.memory_status || meterStatus(health.memory_usage_percent, 72, 88);

  return (
    <section id="system-health" className="panel system-health-panel">
      <div className="panel-header">
        <h3>System Architecture & Health</h3>
        <div className="sys-health-header-meta">
          <span className={`health-chip ${health.overall_status || "green"}`}>
            Overall: {statusLabel(health.overall_status)}
          </span>
          <span className="chip">Updated: {formatTimestamp(health.timestamp)}</span>
        </div>
      </div>

      <div className="system-health-grid grid grid-12">
        <div className="col-6">
          <div className="sys-health-services-grid">
            {(health.microservices || []).map((service) => (
              <ServiceCard key={service.name} item={service} />
            ))}
            {health.database && <ServiceCard item={health.database} />}
          </div>
        </div>

        <div className="col-6">
          <div className="sys-health-meters-grid">
            <TelemetryMeter label="API Latency" value={health.api_latency_ms} unit=" ms" status={apiStatus} />
            <TelemetryMeter label="CPU Usage" value={health.cpu_usage_percent} unit="%" status={cpuStatus} />
            <TelemetryMeter label="Memory Usage" value={health.memory_usage_percent} unit="%" status={memoryStatus} />
          </div>
        </div>
      </div>
    </section>
  );
}
