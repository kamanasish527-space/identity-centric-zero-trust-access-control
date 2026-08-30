import AnimatedCounter from "./AnimatedCounter";

export default function OverviewCards({ overview, zeroTrustScore }) {
  const cards = [
    { label: "Total Users", value: overview?.total_users ?? 0, accent: "cyan", trend: "Identity count", icon: "👥" },
    { label: "Active Sessions", value: overview?.active_sessions ?? 0, accent: "green", trend: "Live sessions", icon: "🔄" },
    {
      label: "High Risk Attempts",
      value: overview?.high_risk_attempts ?? 0,
      accent: "amber",
      trend: "Escalation signals",
      icon: "⚠️"
    },
    { label: "Denied Attempts", value: overview?.denied_attempts ?? 0, accent: "red", trend: "Policy denials", icon: "🚫" },
  ];

  return (
    <section id="overview" className="panel">
      <div className="panel-header">
        <h3>Overview Panel</h3>
        <span className="chip">Zero Trust Score: {zeroTrustScore}</span>
      </div>
      <div className="card-grid">
        {cards.map((card, index) => (
          <article key={card.label} className={`card metric-card accent-${card.accent}`} style={{ animationDelay: `${index * 0.1}s` }}>
            <div className="card-head">
              <div>
                <h4>{card.label}</h4>
                <small>{card.trend}</small>
              </div>
              <div className="metric-icon">{card.icon}</div>
            </div>
            <div className="metric-value">
              <AnimatedCounter value={card.value} decimals={0} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
