import { Icon } from "../layout/Icons";

export default function MetricCard({ label, value, sublabel, icon, accent = "accent", progress }) {
  return (
    <article className="card metric-card">
      <div className="metric-head">
        <div className={`metric-icon ${accent}`}>
          <Icon name={icon} size={16} />
        </div>
        <div>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      </div>
      {sublabel && <small>{sublabel}</small>}
      <div className="metric-bar">
        <span style={{ width: `${progress}%` }} />
      </div>
    </article>
  );
}
