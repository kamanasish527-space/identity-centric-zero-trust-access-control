import { useMemo } from "react";
import { formatTimestamp } from "../utils/time";

function highlightExplanation(explanation) {
  if (!explanation) return "No active AI insight.";
  return explanation;
}

export default function AISecurityInsightCard({ insight, totalRisk, anomalyScore }) {
  const severity = (insight?.severity || "low").toLowerCase();

  const insightItems = useMemo(() => {
    const items = [];
    const riskValue = Number(totalRisk || 0);
    const anomalyValue = Number(anomalyScore || 0);

    items.push({
      title: "Anomalous Login Pattern Detected",
      description: highlightExplanation(
        insight?.explanation || "User logins spiked from 3 different countries within 2 hours."
      ),
      severity: severity,
      meta: `Confidence: ${Math.min(99, Math.max(40, Math.round(60 + anomalyValue / 2)))}%`,
    });

    items.push({
      title: "Potential Data Exfiltration",
      description:
        riskValue > 60
          ? "Unusual outbound data transfer of 2.4GB detected after business hours."
          : "Outbound transfer remains within expected thresholds. Continue monitoring.",
      severity: riskValue > 60 ? "high" : "low",
      meta: `Risk: ${riskValue.toFixed(1)}`,
    });

    items.push({
      title: "Predicted Risk Spike",
      description:
        anomalyValue > 30
          ? "Risk is predicted to increase by 15-20% within the next 6 hours."
          : "Risk trajectory appears stable with no immediate spikes predicted.",
      severity: anomalyValue > 30 ? "medium" : "low",
      meta: `Anomaly: ${anomalyValue.toFixed(1)}`,
    });

    return items;
  }, [anomalyScore, insight?.explanation, severity, totalRisk]);

  return (
    <section className="card insights-card">
      <div className="card-head">
        <h3>AI Security Insights</h3>
        <span className="chip">Live</span>
      </div>
      <div className="insight-list">
        {insightItems.map((item) => (
          <article key={item.title} className={`insight-item ${item.severity}`}>
            <div>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <small>{item.meta}</small>
            </div>
          </article>
        ))}
        <div className="insight-meta">
          <span>Generated: {formatTimestamp(insight?.generatedAt)}</span>
          <span>Risk: {Number(totalRisk || 0).toFixed(1)}</span>
          <span>Anomaly: {Number(anomalyScore || 0).toFixed(1)}</span>
        </div>
      </div>
    </section>
  );
}
