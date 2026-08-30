import { useEffect, useState } from "react";
import { isAdminRole, isAnalystRole, normalizeRole } from "../utils/roles";

export default function SettingsPanel({ settings, onSave, role }) {
  const [form, setForm] = useState(settings);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const effectiveRole = normalizeRole(role);
  const isAdmin = isAdminRole(effectiveRole);
  const isAnalyst = isAnalystRole(effectiveRole);

  if (!(isAdmin || isAnalyst) || !form) {
    return null;
  }

  const isReadOnly = !isAdmin;

  const submit = async (event) => {
    event.preventDefault();
    if (isReadOnly) {
      return;
    }

    setStatus("Saving...");
    try {
      await onSave({
        ...form,
        risk_low_threshold: Number(form.risk_low_threshold),
        risk_medium_threshold: Number(form.risk_medium_threshold),
        risk_high_threshold: Number(form.risk_high_threshold),
        session_monitor_interval_seconds: Number(form.session_monitor_interval_seconds),
      });
      setStatus("Saved");
    } catch (error) {
      setStatus(error?.response?.data?.error?.message || "Failed to save");
    }
  };

  return (
    <form className="settings-grid" onSubmit={submit}>
      <div className="settings-column">
        <h4>Monitoring</h4>
        <label>
          Low Risk Threshold
          <input
            type="number"
            min="0"
            max="100"
            value={form.risk_low_threshold}
            onChange={(e) => setForm((prev) => ({ ...prev, risk_low_threshold: e.target.value }))}
            disabled={isReadOnly}
          />
        </label>

        <label>
          Medium Risk Threshold
          <input
            type="number"
            min="0"
            max="100"
            value={form.risk_medium_threshold}
            onChange={(e) => setForm((prev) => ({ ...prev, risk_medium_threshold: e.target.value }))}
            disabled={isReadOnly}
          />
        </label>

        <label>
          High Risk Threshold
          <input
            type="number"
            min="0"
            max="100"
            value={form.risk_high_threshold}
            onChange={(e) => setForm((prev) => ({ ...prev, risk_high_threshold: e.target.value }))}
            disabled={isReadOnly}
          />
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={form.continuous_monitoring_enabled}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, continuous_monitoring_enabled: e.target.checked }))
            }
            disabled={isReadOnly}
          />
          Enable Continuous Monitoring
        </label>
      </div>

      <div className="settings-column">
        <h4>Performance</h4>
        <label>
          Session Monitor Interval (seconds)
          <input
            type="number"
            min="5"
            max="300"
            value={form.session_monitor_interval_seconds}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, session_monitor_interval_seconds: e.target.value }))
            }
            disabled={isReadOnly}
          />
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={form.mitre_mapping_enabled}
            onChange={(e) => setForm((prev) => ({ ...prev, mitre_mapping_enabled: e.target.checked }))}
            disabled={isReadOnly}
          />
          Enable MITRE ATT&CK Mapping
        </label>
      </div>

      <div className="settings-column">
        <h4>Maintenance</h4>
        {!isReadOnly && (
          <button type="submit" className="ghost-btn">
            Save Settings
          </button>
        )}
        <span className="settings-status">{status}</span>
        {isReadOnly && <small className="settings-hint">Admin rights required to edit settings.</small>}
      </div>
    </form>
  );
}
