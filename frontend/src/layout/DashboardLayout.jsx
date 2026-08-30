import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeRole, roleBadgeLabel } from "../utils/roles";
import { motion, AnimatePresence } from "framer-motion";

const NAV_ITEMS = [
  {
    to: "/dashboard",
    label: "Executive Overview",
    icon: "overview",
    subtitle: "Organization risk posture, exposure metrics, and executive controls",
  },
  {
    to: "/activity-logs",
    label: "Data Details",
    icon: "records",
    subtitle: "Credential and access telemetry records with analyst filtering",
  },
  {
    to: "/risk-analytics",
    label: "Predictive & Risk Analytics",
    navLabel: "Predictive & Risk",
    icon: "chart",
    subtitle: "Live scoring trajectory, risk factors, and policy outcomes",
  },
  {
    to: "/session-monitor",
    label: "Behavioral Analysis",
    icon: "session",
    subtitle: "Session behavior surveillance and anomaly stream monitoring",
  },
  {
    to: "/threat-intel",
    label: "Network & Relations",
    icon: "network",
    subtitle: "MITRE mapping, threat feed, and global origin intelligence",
  },
  {
    to: "/system-health",
    label: "Actionable Intelligence",
    icon: "health",
    subtitle: "Platform architecture telemetry, services, and policy readiness",
  },
  {
    to: "/simulation-lab",
    label: "Forensic Deep-Dive / Simulation Lab",
    navLabel: "Simulation Lab",
    icon: "forensics",
    subtitle: "Attack simulation and security response testing",
    roles: ["admin"],
  },
];

function Icon({ type, className = "" }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9 };

  switch (type) {
    case "overview":
      return (
        <svg {...common} className={className}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M8 16V9" /><path d="M12 16V7" /><path d="M16 16v-4" /></svg>
      );
    case "records":
      return (
        <svg {...common} className={className}><path d="M8 4h11v16H5V7z" /><path d="M8 4v3H5" /><path d="M9 11h7" /><path d="M9 15h7" /></svg>
      );
    case "grid":
      return (
        <svg {...common} className={className}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
      );
    case "logs":
      return (
        <svg {...common} className={className}><path d="M8 6h11" /><path d="M8 12h11" /><path d="M8 18h11" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>
      );
    case "threat":
      return (
        <svg {...common} className={className}><path d="M12 3l8 4v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7l8-4z" /><path d="M12 8v5" /><circle cx="12" cy="16" r="1" /></svg>
      );
    case "chart":
      return (
        <svg {...common} className={className}><path d="M4 18L10 12l4 3 6-7" /><path d="M4 6v12h16" /></svg>
      );
    case "session":
      return (
        <svg {...common} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      );
    case "network":
      return (
        <svg {...common} className={className}><circle cx="6" cy="6" r="2.3" /><circle cx="18" cy="7" r="2.3" /><circle cx="9" cy="18" r="2.3" /><circle cx="19" cy="17" r="2.3" /><path d="M7.8 7.4l7.9-0.9" /><path d="M7.3 7.6l1.9 8" /><path d="M10.8 17.5h6" /></svg>
      );
    case "admin":
      return (
        <svg {...common} className={className}><circle cx="12" cy="8" r="3" /><path d="M4 20c0-3.2 3.6-5 8-5s8 1.8 8 5" /></svg>
      );
    case "settings":
      return (
        <svg {...common} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5h0a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z" /></svg>
      );
    case "bell":
      return (
        <svg {...common} className={className}><path d="M15 17H5l1.5-1.8V11a5.5 5.5 0 0 1 11 0v4.2L19 17h-4" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
      );
    case "health":
      return (
        <svg {...common} className={className}><path d="M3 12h4l2-4 3 8 2-4h7" /></svg>
      );
    case "moon":
      return (
        <svg {...common} className={className}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z" /></svg>
      );
    case "sun":
      return (
        <svg {...common} className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M4.9 4.9l1.4 1.4" /><path d="M17.7 17.7l1.4 1.4" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M4.9 19.1l1.4-1.4" /><path d="M17.7 6.3l1.4-1.4" /></svg>
      );
    case "menu":
      return (
        <svg {...common} className={className}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>
      );
    case "lab":
      return (
        <svg {...common} className={className}><path d="M9 3v5l-5 9a3 3 0 0 0 2.6 4.5h10.8A3 3 0 0 0 20 17L15 8V3" /><path d="M9 8h6" /><path d="M8 14h8" /></svg>
      );
    case "forensics":
      return (
        <svg {...common} className={className}><path d="M15 15l5 5" /><circle cx="10.5" cy="10.5" r="6.5" /><path d="M8.5 10.5h4" /><path d="M10.5 8.5v4" /></svg>
      );
    case "scan":
      return (
        <svg {...common} className={className}><circle cx="10" cy="10" r="6" /><path d="M14.5 14.5L20 20" /></svg>
      );
    case "search":
      return (
        <svg {...common} className={className}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      );
    case "connector":
      return (
        <svg {...common} className={className}><path d="M8 12h8" /><path d="M12 8v8" /><circle cx="12" cy="12" r="9" /></svg>
      );
    default:
      return null;
  }
}

function notificationKey(item) {
  const ts = String(item?.timestamp || "");
  const technique = String(item?.technique_id || "");
  const summary = String(item?.summary || "");
  return `${ts}::${technique}::${summary}`;
}

export default function DashboardLayout({
  user,
  onLogout,
  children,
  systemHealth = "operational",
  notifications = [],
  telemetry = null,
}) {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState({});
  const [bellAnimated, setBellAnimated] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const previousNotificationKeysRef = useRef(new Set());
  const hasMountedRef = useRef(false);
  const location = useLocation();

  const effectiveRole = normalizeRole(user?.role);
  const roleLabel = roleBadgeLabel(effectiveRole);

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(effectiveRole));
  const activeNavItem = useMemo(
    () =>
      NAV_ITEMS.find(
        (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
      ),
    [location.pathname]
  );
  const normalizedNotifications = useMemo(
    () =>
      notifications.map((item, idx) => ({
        ...item,
        _key: notificationKey(item) || `notification-${idx}`,
      })),
    [notifications]
  );

  const unreadNotifications = useMemo(
    () => normalizedNotifications.filter((item) => !readNotifications[item._key]),
    [normalizedNotifications, readNotifications]
  );
  const notificationCount = unreadNotifications.length;
  const displayNotifications = normalizedNotifications.slice(0, 5);

  const healthLabel = useMemo(() => {
    const normalized = String(systemHealth || "").toLowerCase();
    if (normalized === "degraded") {
      return "Degraded";
    }
    if (normalized === "monitoring") {
      return "Monitoring";
    }
    return "Operational";
  }, [systemHealth]);

  useEffect(() => {
    const saved = localStorage.getItem("zt-ui-theme");
    const initial = saved === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const initials = useMemo(
    () => (user?.username || user?.email || "U").slice(0, 1).toUpperCase(),
    [user?.username, user?.email]
  );

  const markAllNotificationsRead = useCallback(() => {
    if (normalizedNotifications.length === 0) {
      return;
    }

    setReadNotifications((prev) => {
      const next = { ...prev };
      normalizedNotifications.forEach((item) => {
        next[item._key] = true;
      });
      return next;
    });
  }, [normalizedNotifications]);

  useEffect(() => {
    // Keep read-state map bounded to current notification list.
    setReadNotifications((prev) => {
      const active = new Set(normalizedNotifications.map((item) => item._key));
      const next = {};
      let changed = false;

      Object.entries(prev).forEach(([key, value]) => {
        if (active.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [normalizedNotifications]);

  useEffect(() => {
    const currentKeys = new Set(normalizedNotifications.map((item) => item._key));

    if (!hasMountedRef.current) {
      previousNotificationKeysRef.current = currentKeys;
      hasMountedRef.current = true;
      return;
    }

    let hasNewNotification = false;
    currentKeys.forEach((key) => {
      if (!previousNotificationKeysRef.current.has(key)) {
        hasNewNotification = true;
      }
    });

    previousNotificationKeysRef.current = currentKeys;

    if (hasNewNotification) {
      setBellAnimated(true);
      const timer = window.setTimeout(() => setBellAnimated(false), 950);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [normalizedNotifications]);

  useEffect(() => {
    if (alertsOpen && unreadNotifications.length > 0) {
      markAllNotificationsRead();
    }
  }, [alertsOpen, unreadNotifications.length, markAllNotificationsRead]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClock(new Date());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const tickerItems = useMemo(() => {
    const samples = [];
    if (telemetry?.highRiskAttempts != null) {
      samples.push(
        `ZeroTrust - ${Number(telemetry.highRiskAttempts)} high-risk attempts detected (LIVE DATA)`
      );
    }
    if (telemetry?.activeSessions != null && telemetry?.totalUsers != null) {
      samples.push(
        `${Number(telemetry.activeSessions)} active sessions across ${Number(telemetry.totalUsers)} monitored identities`
      );
    }
    normalizedNotifications.slice(0, 3).forEach((item) => {
      if (item.summary) {
        samples.push(item.summary);
      }
    });
    if (samples.length === 0) {
      samples.push("Zero trust telemetry stream online. Waiting for enriched threat signals.");
    }
    return samples.slice(0, 4);
  }, [normalizedNotifications, telemetry?.activeSessions, telemetry?.highRiskAttempts, telemetry?.totalUsers]);

  const formattedClock = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(clock),
    [clock]
  );

  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Responsive sidebar toggle
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth > 900);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="cw-shell">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            className="cw-sidebar glassy"
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ type: "spring", stiffness: 80, damping: 18 }}
          >
            <div className="cw-brand">
              <div className="cw-logo glassy">CW</div>
              <div>
                <h1>CyberWatch Analytics</h1>
                <span>Enterprise Security Platform</span>
              </div>
            </div>
            <nav className="cw-nav">
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? "active nav-anim" : "nav-anim"
                  }
                  onClick={() => {
                    setProfileOpen(false);
                    setAlertsOpen(false);
                  }}
                >
                  <span className="nav-icon-wrap">
                    <Icon type={item.icon} className="nav-icon" />
                  </span>
                  <span>{item.navLabel || item.label}</span>
                  <motion.div
                    className="nav-active-indicator"
                    layoutId="nav-active-indicator"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    style={{ display: "inline-block", width: 0, height: 0 }}
                  />
                </NavLink>
              ))}
            </nav>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(false)}
              aria-label="Collapse sidebar"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
          </motion.aside>
        )}
      </AnimatePresence>
      <div className="cw-main">
        <button
          className="sidebar-toggle open"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar"
          style={{ display: sidebarOpen ? "none" : "block" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>
        </button>
        <motion.header
          className="cw-topbar"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="cw-topbar-spacer" />
          <div className="cw-topbar-right">
            <motion.span
              className={`system-pill ${systemHealth}`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              whileHover={{ scale: 1.05 }}
            >
              {systemHealth === "operational"
                ? "🟢 All Systems Operational"
                : systemHealth === "monitoring"
                ? "🟡 System Monitoring"
                : "🔴 System Degraded"}
            </motion.span>

            <div className="topbar-dropdown-wrap">
              <button
                type="button"
                className={`cw-icon-btn ${bellAnimated && notificationCount > 0 ? "notif-alert-pulse" : ""}`}
                onClick={() => {
                  setAlertsOpen((prev) => {
                    const nextOpen = !prev;
                    if (nextOpen) {
                      markAllNotificationsRead();
                      setBellAnimated(false);
                    }
                    return nextOpen;
                  });
                  setProfileOpen(false);
                }}
                title="Notifications"
              >
                <Icon type="bell" />
                {notificationCount > 0 && <span className="notif-badge">{notificationCount}</span>}
              </button>

              {alertsOpen && (
                <div className="dropdown-panel notifications-panel">
                  <h4>Security Alerts</h4>
                  {displayNotifications.length === 0 ? (
                    <p>No active alerts</p>
                  ) : (
                    <ul>
                      {displayNotifications.map((item, idx) => (
                        <li key={`${item._key}-${idx}`}>
                          <strong>{item.technique_id || "Behavior anomaly"}</strong>
                          <span>{item.summary}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <button className="cw-icon-btn" type="button" title="Settings">
              <Icon type="settings" />
            </button>

            <div className="topbar-dropdown-wrap">
              <button
                type="button"
                className="cw-profile-chip"
                onClick={() => {
                  setProfileOpen((prev) => !prev);
                  setAlertsOpen(false);
                }}
              >
                <span className="cw-avatar">{initials}</span>
                <span>{user?.username || "admin"}</span>
              </button>

              {profileOpen && (
                <div className="dropdown-panel profile-panel">
                  <div className="profile-panel-head">
                    <strong>{user?.username || "user"}</strong>
                    <span>{roleLabel}</span>
                    <small>{user?.email}</small>
                  </div>
                  <button className="ghost-btn" onClick={onLogout}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        </motion.header>

        <motion.main
          className="cw-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.section
            className="cw-page-header"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <h2 className="gradient-text">{activeNavItem?.label || "Security Operations Center"}</h2>
            <p>{activeNavItem?.subtitle || "Real-time identity, access, and behavioral threat monitoring"}</p>
          </motion.section>
          <MotionPage>
            {children}
          </MotionPage>
          <motion.div
            className="cw-footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.3 }}
          >
            EXAMPLE DATA - For demonstration purposes only.
          </motion.div>
        </motion.main>
      </div>
    </div>
  );
}


