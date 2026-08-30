function TrustRing({ score }) {
  const clamped = Math.max(0, Math.min(100, Number(score || 0)));
  return (
    <div className="trust-ring" style={{ "--score": `${clamped}%` }}>
      <div>
        <strong>{clamped}</strong>
        <span>Trust</span>
      </div>
    </div>
  );
}

export default function UserSecurityProfileCard({ profile }) {
  const trustLevelClass = `pill ${profile?.trust_level || "low"}`;
  const heatmapRows = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 12 }, (_, slot) => {
      const anchor = Number(profile?.average_login_hour || 0) / 2;
      const diff = Math.abs(slot - anchor);
      const value = Math.max(0.05, 1 - diff / 6 - day * 0.03);
      return Math.round(value * 100);
    })
  );

  return (
    <section id="profile" className="panel">
      <div className="panel-header">
        <h3>User Security Profile</h3>
        <span className={trustLevelClass}>{profile?.trust_level || "unknown"}</span>
      </div>

      <div className="profile-grid">
        <TrustRing score={profile?.trust_score || 0} />

        <div className="profile-details">
          <div><span>Current Risk</span><strong>{profile?.current_risk_score ?? 0}</strong></div>
          <div><span>Risk Level</span><strong>{profile?.current_risk_level || "low"}</strong></div>
          <div><span>Avg Login Hour</span><strong>{(profile?.average_login_hour || 0).toFixed(1)}</strong></div>
          <div><span>Access/Day</span><strong>{(profile?.access_frequency_per_day || 0).toFixed(1)}</strong></div>
        </div>
      </div>

      <div className="baseline-lists">
        <div>
          <h4>Known Locations</h4>
          <p>{(profile?.known_locations || []).join(", ") || "None yet"}</p>
        </div>
        <div>
          <h4>Known Devices</h4>
          <p>{(profile?.known_device_fingerprints || []).join(", ") || "None yet"}</p>
        </div>
        <div>
          <h4>IP History</h4>
          <p>{(profile?.ip_history || []).join(", ") || "None yet"}</p>
        </div>
      </div>

      <div className="heatmap-box">
        <h4>Behavioral Heatmap</h4>
        <div className="mini-heatmap">
          {heatmapRows.flat().map((cell, idx) => (
            <span key={idx} style={{ opacity: Math.max(0.08, cell / 100) }} />
          ))}
        </div>
      </div>
    </section>
  );
}
