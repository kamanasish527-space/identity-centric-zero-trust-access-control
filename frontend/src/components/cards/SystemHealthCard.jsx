export default function SystemHealthCard({ services = [], onView }) {
  return (
    <article className="card health-card">
      <div className="card-head">
        <h3>System Health</h3>
      </div>
      <div className="health-list">
        {services.map((service) => (
          <div key={service.name} className="health-row">
            <div>
              <span className={`health-dot ${service.status}`} />
              <span>{service.name}</span>
            </div>
            <span className={`pill ${service.status}`}>{service.label}</span>
          </div>
        ))}
      </div>
      <button type="button" className="ghost-btn" onClick={onView}>View Details</button>
    </article>
  );
}
