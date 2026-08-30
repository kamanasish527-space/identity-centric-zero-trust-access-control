import { Icon } from "../layout/Icons";

export default function StatCard({ label, value, icon, accent = "blue", sublabel }) {
  return (
    <article className="card stat-card">
      <div className={`stat-icon ${accent}`}>
        <Icon name={icon} size={16} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {sublabel && <small>{sublabel}</small>}
      </div>
    </article>
  );
}
