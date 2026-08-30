import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getStoredLocation } from "../utils";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, verifyStepUp, mapApiError } = useAuth();

  const [form, setForm] = useState({
    identifier: "",
    password: "",
    location: getStoredLocation(),
    simulatedPhishing: false,
  });
  const [challenge, setChallenge] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submitLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(form);
      if (result.status === "step_up_required") {
        setChallenge(result);
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(mapApiError(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  const submitStepUp = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await verifyStepUp({
        challengeId: challenge.challengeId,
        otpCode,
        location: form.location,
      });
      navigate("/");
    } catch (err) {
      setError(mapApiError(err, "Step-up verification failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-950 to-black opacity-80" />
      <div className="relative w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/90 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-gray-100 mb-2">AI Zero Trust Access</h1>
        <p className="text-sm text-gray-500 mb-6">Continuous identity verification with adaptive policy enforcement</p>

        {!challenge ? (
          <form onSubmit={submitLogin} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400">Username or Email</label>
              <input
                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
                value={form.identifier}
                onChange={(e) => setForm((prev) => ({ ...prev, identifier: e.target.value }))}
                placeholder="analyst@company.com"
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-400">Password</label>
              <input
                type="password"
                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Enter password"
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-400">Simulated Location</label>
              <input
                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="US-CA-SFO"
                required
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-700 bg-gray-800"
                checked={form.simulatedPhishing}
                onChange={(e) => setForm((prev) => ({ ...prev, simulatedPhishing: e.target.checked }))}
              />
              Simulate Phishing Signal (T1566)
            </label>

            {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}

            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
              disabled={loading}
            >
              {loading ? "Authenticating..." : "Secure Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitStepUp} className="space-y-4">
            <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-3 text-sm text-gray-200">
              <strong className="block text-gray-100">Step-Up Authentication Required</strong>
              <p className="text-xs text-gray-400">Risk Score {challenge.riskScore} ({challenge.riskLevel})</p>
              <p className="text-xs text-gray-400">Simulation OTP: {challenge.otpHint}</p>
            </div>

            <div>
              <label className="text-xs text-gray-400">OTP Code</label>
              <input
                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter OTP"
                required
              />
            </div>

            {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}

            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify and Continue"}
            </button>
          </form>
        )}

        <footer className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
          <span>New user?</span>
          <Link className="text-indigo-400 hover:text-indigo-300" to="/register">
            Create account
          </Link>
        </footer>
      </div>
    </div>
  );
}
