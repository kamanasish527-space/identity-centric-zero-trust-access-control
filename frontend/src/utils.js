export const storageKeys = {
  accessToken: "zt_access_token",
  refreshToken: "zt_refresh_token",
  csrfToken: "zt_csrf_token",
  sessionId: "zt_session_id",
  role: "zt_role",
  location: "zt_location",
};

export function getFingerprint() {
  const raw = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    `${window.screen.width}x${window.screen.height}`,
  ].join("|");

  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }

  return `fp_${Math.abs(hash).toString(16)}`;
}

export function getStoredLocation() {
  return localStorage.getItem(storageKeys.location) || "US-CA-SFO";
}

export function setStoredLocation(value) {
  localStorage.setItem(storageKeys.location, value);
}
