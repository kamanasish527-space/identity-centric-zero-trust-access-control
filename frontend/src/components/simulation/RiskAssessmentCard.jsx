export default function RiskAssessmentCard({ riskScore, detectionRate, responseTime, resilience, grade }) {
  return (
    <article className="card sim-assessment-card">
      <div className="card-head">
        <h3>Risk Assessment</h3>
      </div>
      <div className="assessment-row">
        <span>Attack Complexity</span>
        <strong>{riskScore > 70 ? "High" : riskScore > 40 ? "Medium" : "Low"}</strong>
        <div className="assessment-bar">
          <span style={{ width: `${Math.min(100, riskScore)}%` }} />
        </div>
      </div>
      <div className="assessment-row">
        <span>Detection Rate</span>
        <strong>{detectionRate}%</strong>
        <div className="assessment-bar">
          <span style={{ width: `${detectionRate}%` }} />
        </div>
      </div>
      <div className="assessment-row">
        <span>Response Time</span>
        <strong>{responseTime}</strong>
        <div className="assessment-bar">
          <span style={{ width: `${Math.min(100, 100 - riskScore)}%` }} />
        </div>
      </div>
      <div className="assessment-row">
        <span>System Resilience</span>
        <strong>{resilience}</strong>
        <div className="assessment-bar">
          <span style={{ width: `${Math.min(100, 100 - riskScore / 1.4)}%` }} />
        </div>
      </div>
      <div className="assessment-score">
        <span>Overall Score</span>
        <strong>{grade}</strong>
        <small>Security posture</small>
      </div>
    </article>
  );
}
