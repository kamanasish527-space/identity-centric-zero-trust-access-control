export function normalizeRole(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "user") {
    return "viewer";
  }
  if (normalized === "viewer" || normalized === "analyst" || normalized === "admin") {
    return normalized;
  }
  return "viewer";
}

export function isAdminRole(role) {
  return normalizeRole(role) === "admin";
}

export function isAnalystRole(role) {
  return normalizeRole(role) === "analyst";
}

export function isViewerRole(role) {
  return normalizeRole(role) === "viewer";
}

export function roleLabel(role) {
  const normalized = normalizeRole(role);
  if (normalized === "admin") {
    return "Admin";
  }
  if (normalized === "analyst") {
    return "Security Analyst";
  }
  return "Viewer";
}

export function roleBadgeLabel(role) {
  const normalized = normalizeRole(role);
  if (normalized === "admin") {
    return "Zero Trust Admin";
  }
  if (normalized === "analyst") {
    return "Security Analyst";
  }
  return "Viewer";
}
