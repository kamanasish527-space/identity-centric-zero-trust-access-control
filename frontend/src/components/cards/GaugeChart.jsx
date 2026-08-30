function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function buildArc(size, radius, score) {
  const center = size / 2;
  const startAngle = Math.PI;
  const progressAngle = Math.PI * (1 - score / 100);
  const startX = center + radius * Math.cos(startAngle);
  const startY = center + radius * Math.sin(startAngle);
  const endX = center + radius * Math.cos(progressAngle);
  const endY = center + radius * Math.sin(progressAngle);
  const largeArc = score > 50 ? 1 : 0;
  return {
    track: `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`,
    progress: `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`,
  };
}

export default function GaugeCard({ label, value, tone, accent = "accent", footerLeft, footerRight }) {
  const score = clamp(Number(value || 0));
  const size = 220;
  const radius = 82;
  const stroke = 14;
  const { track, progress } = buildArc(size, radius, score);

  return (
    <article className="card gauge-card">
      <div className="card-head">
        <h3>{label}</h3>
        {tone && <span className={`pill ${tone.toLowerCase()}`}>{tone}</span>}
      </div>
      <div className="gauge-wrap">
        <svg width={size} height={120} viewBox={`0 0 ${size} 120`} aria-hidden="true">
          <path d={track} stroke="rgba(148,163,184,0.22)" strokeWidth={stroke} fill="none" strokeLinecap="round" />
          <path d={progress} stroke={`var(--${accent})`} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        </svg>
        <div className="gauge-center">
          <strong>{Math.round(score)}</strong>
          <span>out of 100</span>
        </div>
      </div>
      <div className="gauge-footer">
        <div>
          <strong>{footerLeft?.value}</strong>
          <small>{footerLeft?.label}</small>
        </div>
        <div>
          <strong>{footerRight?.value}</strong>
          <small>{footerRight?.label}</small>
        </div>
      </div>
    </article>
  );
}
