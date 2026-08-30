import { formatTimestamp } from "../utils/time";

export default function ThreatIntelPanel({ feed }) {
  return (
    <section className="card threat-card">
      <div className="card-head">
        <h3>Threat Intelligence</h3>
        <span className="chip">Live Feed</span>
      </div>

      <div className="threat-feed">
        {feed.length === 0 ? (
          <article className="threat-item">
            <div>
              <strong>No active threat anomalies</strong>
            </div>
            <p>MITRE-mapped alerts and behavioral detections will appear here in real time.</p>
          </article>
        ) : (
          feed.slice(0, 10).map((item, index) => (
            <article key={`${item.timestamp}-${index}`} className={`threat-item ${item.severity}`}>
              <div className="threat-head">
                <span className={`threat-icon ${item.severity}`} />
                <strong>{item.technique_id || "Behavioral anomaly"}</strong>
                <span className={`pill ${item.severity || "warning"}`}>{item.severity || "warning"}</span>
              </div>
              <p>{item.summary}</p>
              <footer>
                <span>{item.technique_name || "Unknown technique"}</span>
                <span>{formatTimestamp(item.timestamp)}</span>
              </footer>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
