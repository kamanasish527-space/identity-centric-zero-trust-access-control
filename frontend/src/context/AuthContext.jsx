import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiClient, clearAuth, getAuthSnapshot, persistAuth } from "../api/client";
import { getFingerprint, setStoredLocation, storageKeys } from "../utils";
import { normalizeRole } from "../utils/roles";

const AuthContext = createContext(null);

function mapApiError(error, fallback) {
  const payload = error?.response?.data?.error;
  if (payload?.message) {
    return payload.message;
  }
  if (error?.response?.status === 422) {
    const firstDetail = error?.response?.data?.error?.details?.[0];
    if (firstDetail?.msg) {
      return firstDetail.msg;
    }
  }
  if (!error?.response) {
    return "Cannot reach backend API. Start backend on http://localhost:8000 and try again.";
  }
  return fallback;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
    };

    window.addEventListener("zt-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("zt-auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    const boot = async () => {
      const { accessToken } = getAuthSnapshot();
      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await apiClient.get("/auth/me");
        setUser(response.data);
        localStorage.setItem(storageKeys.role, normalizeRole(response.data.role));
      } catch {
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    boot();
  }, []);

  const register = async (payload) => {
    await apiClient.post("/auth/register", payload);
  };

  const login = async ({ identifier, password, location, simulatedPhishing = false }) => {
    setStoredLocation(location);

    const response = await apiClient.post("/auth/login", {
      identifier,
      password,
      location,
      device_fingerprint: getFingerprint(),
      protocol: "https",
      simulated_phishing: simulatedPhishing,
    });

    if (response.data.status === "step_up_required") {
      return {
        status: "step_up_required",
        challengeId: response.data.challenge_id,
        otpHint: response.data.otp_hint,
        riskScore: response.data.risk_score,
        riskLevel: response.data.risk_level,
      };
    }

    persistAuth(response.data);
    const me = await apiClient.get("/auth/me");
    setUser(me.data);
    localStorage.setItem(storageKeys.role, normalizeRole(me.data.role));

    return { status: "success" };
  };

  const verifyStepUp = async ({ challengeId, otpCode, location }) => {
    setStoredLocation(location);

    const response = await apiClient.post("/auth/step-up", {
      challenge_id: challengeId,
      otp_code: otpCode,
      location,
      device_fingerprint: getFingerprint(),
      protocol: "https",
    });

    persistAuth(response.data);
    const me = await apiClient.get("/auth/me");
    setUser(me.data);
    localStorage.setItem(storageKeys.role, normalizeRole(me.data.role));
    return response.data;
  };

  const logout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Ignore logout failures and clear client state regardless.
    } finally {
      clearAuth();
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      register,
      login,
      verifyStepUp,
      logout,
      mapApiError,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}


