export function Icon({ name, className = "", size = 18 }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
  };

  switch (name) {
    case "shield":
      return (
        <svg {...props}><path d="M12 3l8 4v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7l8-4z" /></svg>
      );
    case "overview":
      return (
        <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 15V9" /><path d="M12 15V7" /><path d="M17 15v-4" /></svg>
      );
    case "data":
      return (
        <svg {...props}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h6" /></svg>
      );
    case "risk":
      return (
        <svg {...props}><path d="M4 18L10 12l4 3 6-7" /><path d="M4 6v12h16" /></svg>
      );
    case "behavior":
      return (
        <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      );
    case "network":
      return (
        <svg {...props}><circle cx="6" cy="6" r="2.3" /><circle cx="18" cy="7" r="2.3" /><circle cx="9" cy="18" r="2.3" /><circle cx="19" cy="17" r="2.3" /><path d="M7.8 7.4l7.9-0.9" /><path d="M7.3 7.6l1.9 8" /><path d="M10.8 17.5h6" /></svg>
      );
    case "action":
      return (
        <svg {...props}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>
      );
    case "simulation":
      return (
        <svg {...props}><path d="M9 3v5l-5 9a3 3 0 0 0 2.6 4.5h10.8A3 3 0 0 0 20 17L15 8V3" /><path d="M9 8h6" /><path d="M8 14h8" /></svg>
      );
    case "bell":
      return (
        <svg {...props}><path d="M15 17H5l1.5-1.8V11a5.5 5.5 0 0 1 11 0v4.2L19 17h-4" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
      );
    case "gear":
      return (
        <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5h0a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z" /></svg>
      );
    case "search":
      return (
        <svg {...props}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      );
    case "filter":
      return (
        <svg {...props}><path d="M4 5h16l-6 7v6l-4 2v-8z" /></svg>
      );
    case "download":
      return (
        <svg {...props}><path d="M12 3v10" /><path d="M8 9l4 4 4-4" /><path d="M5 19h14" /></svg>
      );
    case "play":
      return (
        <svg {...props}><polygon points="6,4 20,12 6,20" fill="currentColor" stroke="none" /></svg>
      );
    case "reset":
      return (
        <svg {...props}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
      );
    case "export":
      return (
        <svg {...props}><path d="M12 3v12" /><path d="M8 9l4 4 4-4" /><path d="M5 19h14" /></svg>
      );
    case "user":
      return (
        <svg {...props}><circle cx="12" cy="8" r="3" /><path d="M4 20c0-3.2 3.6-5 8-5s8 1.8 8 5" /></svg>
      );
    case "alert":
      return (
        <svg {...props}><path d="M12 8v5" /><circle cx="12" cy="16" r="1" /><path d="M10 2h4l7 18H3z" /></svg>
      );
    case "shield-check":
      return (
        <svg {...props}><path d="M12 3l8 4v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7l8-4z" /><path d="M9 12l2 2 4-4" /></svg>
      );
    case "lock":
      return (
        <svg {...props}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
      );
    case "trend":
      return (
        <svg {...props}><path d="M3 17l5-5 4 4 7-8" /><path d="M14 8h5v5" /></svg>
      );
    case "clock":
      return (
        <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      );
    case "chevron-right":
      return (
        <svg {...props}><path d="M9 6l6 6-6 6" /></svg>
      );
    case "chevron-left":
      return (
        <svg {...props}><path d="M15 6l-6 6 6 6" /></svg>
      );
    default:
      return null;
  }
}
