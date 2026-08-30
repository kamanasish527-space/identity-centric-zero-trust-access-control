import { Icon } from "../layout/Icons";

export default function SimulationControls({
  progress,
  elapsed,
  running,
  onStart,
  onStop,
  onReset,
}) {
  return (
    <article className="card sim-controls-card">
      <div className="card-head">
        <h3>Attack Simulation Controls</h3>
        <span className="chip">Simulation Progress</span>
      </div>
      <div className="sim-progress">
        <div className="sim-progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="sim-progress-meta">
          <small>{progress}%</small>
          <small>Duration {elapsed}</small>
        </div>
      </div>
      <div className="sim-controls-row">
        <button type="button" className="primary-btn" onClick={onStart} disabled={running}>
          <Icon name="play" size={14} /> Start Simulation
        </button>
        <button type="button" className="ghost-btn" onClick={onReset}>
          <Icon name="reset" size={14} /> Reset
        </button>
      </div>
    </article>
  );
}
