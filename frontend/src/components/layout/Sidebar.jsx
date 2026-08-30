import { NavLink } from "react-router-dom";
import { Icon } from "./Icons";

export default function Sidebar({ items = [] }) {
  return (
    <aside className="cw-sidebar">
      <div className="cw-brand">
        <div className="cw-brand-icon">
          <Icon name="shield" size={24} />
        </div>
        <div>
          <h1>CyberWatch Analytics</h1>
          <span>Enterprise Security Platform</span>
        </div>
      </div>
      <nav className="cw-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => isActive ? "active" : undefined}
          >
            <span className="icon"><Icon name={item.icon} size={20} /></span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
