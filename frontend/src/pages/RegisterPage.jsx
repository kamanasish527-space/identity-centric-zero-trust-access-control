import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function passwordStrength(password) {
  let score = 0;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\w\s]/.test(password)) score += 1;
  return score;
}

export default function RegisterPage() {
  const { register, mapApiError } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);
  const strengthLabel = ["Weak", "Weak", "Fair", "Good", "Strong", "Excellent"][strength];

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await register({ username: form.username, email: form.email, password: form.password });
      navigate("/login");
    } catch (err) {
      setError(mapApiError(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-950 to-black opacity-80" />
      <div className="relative w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/90 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-gray-100 mb-2">Create Secure Identity</h1>
        <p className="text-sm text-gray-500 mb-6">Provision a monitored account with behavior-aware trust baseline</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400">Username</label>
            <input
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Email</label>
            <input
              type="email"
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
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
              required
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-gray-800">
              <div
                className="h-2 rounded-full bg-indigo-500"
                style={{ width: `${(strength / 5) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">{strengthLabel}</span>
          </div>

          <div>
            <label className="text-xs text-gray-400">Confirm Password</label>
            <input
              type="password"
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
              value={form.confirmPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              required
            />
          </div>

          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Register"}
          </button>
        </form>

        <footer className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
          <span>Already registered?</span>
          <Link className="text-indigo-400 hover:text-indigo-300" to="/login">
            Back to login
          </Link>
        </footer>
      </div>
    </div>
  );
}
