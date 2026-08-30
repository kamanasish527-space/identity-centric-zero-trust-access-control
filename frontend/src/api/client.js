import axios from "axios";
import { storageKeys } from "../utils";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

export function getAuthSnapshot() {
  return {
    accessToken: localStorage.getItem(storageKeys.accessToken),
    refreshToken: localStorage.getItem(storageKeys.refreshToken),
    csrfToken: localStorage.getItem(storageKeys.csrfToken),
    sessionId: localStorage.getItem(storageKeys.sessionId),
    role: localStorage.getItem(storageKeys.role),
  };
}

export function persistAuth(data) {
  if (data.access_token) {
    localStorage.setItem(storageKeys.accessToken, data.access_token);
  }
  if (data.refresh_token) {
    localStorage.setItem(storageKeys.refreshToken, data.refresh_token);
  }
  if (data.csrf_token) {
    localStorage.setItem(storageKeys.csrfToken, data.csrf_token);
  }
  if (data.session_id) {
    localStorage.setItem(storageKeys.sessionId, data.session_id);
  }
}

export function clearAuth() {
  localStorage.removeItem(storageKeys.accessToken);
  localStorage.removeItem(storageKeys.refreshToken);
  localStorage.removeItem(storageKeys.csrfToken);
  localStorage.removeItem(storageKeys.sessionId);
  localStorage.removeItem(storageKeys.role);
}

let refreshInFlight = null;

apiClient.interceptors.request.use((config) => {
  const { accessToken, csrfToken } = getAuthSnapshot();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  const method = (config.method || "get").toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method) && csrfToken) {
    config.headers["X-CSRF-Token"] = csrfToken;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (!original || status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (original.url?.includes("/auth/login") || original.url?.includes("/auth/refresh")) {
      return Promise.reject(error);
    }

    original._retry = true;
    const refreshToken = localStorage.getItem(storageKeys.refreshToken);

    if (!refreshInFlight) {
      refreshInFlight = refreshClient
        .post("/auth/refresh", refreshToken ? { refresh_token: refreshToken } : {})
        .then((resp) => {
          persistAuth(resp.data);
          return resp.data;
        })
        .finally(() => {
          refreshInFlight = null;
        });
    }

    try {
      await refreshInFlight;
      const newToken = localStorage.getItem(storageKeys.accessToken);
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
      }
      return apiClient(original);
    } catch (refreshError) {
      clearAuth();
      window.dispatchEvent(new CustomEvent("zt-auth-expired"));
      return Promise.reject(refreshError);
    }
  }
);
