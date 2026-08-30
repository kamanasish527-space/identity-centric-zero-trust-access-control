import { useEffect, useMemo, useState } from "react";
import { formatTimestamp, parseApiTimestamp } from "../../utils/time";
import { Icon } from "../layout/Icons";

const PAGE_SIZE = 10;

function normalize(value) {
  return String(value || "").toLowerCase();
}

export default function DataDetailsTable({ logs, onExport }) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("24h");
  const [page, setPage] = useState(1);

  const filteredLogs = useMemo(() => {
    const query = normalize(search).trim();
    const now = Date.now();
    const rangeMs =
      timeRange === "24h"
        ? 24 * 60 * 60 * 1000
        : timeRange === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : timeRange === "30d"
        ? 30 * 24 * 60 * 60 * 1000
        : null;

    return logs.filter((log) => {
      if (riskFilter !== "all" && String(log.risk_level || "").toLowerCase() !== riskFilter) {
        return false;
      }

      if (rangeMs) {
        const ts = parseApiTimestamp(log.timestamp);
        if (!ts || now - ts.getTime() > rangeMs) {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      const blob = [
        log.timestamp,
        log.username,
        log.user_id,
        log.risk_level,
        log.risk_score,
        log.decision,
        log.mitre_technique_id,
        log.mitre_technique_name,
        log.ip_address,
        log.device_id,
        log.message,
        log.action,
      ]
        .map((item) => normalize(item))
        .join(" ");

      return blob.includes(query);
    });
  }, [logs, riskFilter, search, timeRange]);

  useEffect(() => {
    setPage(1);
  }, [search, riskFilter, timeRange, logs.length]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedLogs = filteredLogs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pageList = useMemo(() => {
    const windowSize = 5;
    if (totalPages <= windowSize) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, start + windowSize - 1);
    const adjustedStart = Math.max(1, end - windowSize + 1);
    return Array.from({ length: end - adjustedStart + 1 }, (_, idx) => adjustedStart + idx);
  }, [safePage, totalPages]);

  const resolveLocation = (log) => {
    if (log.location) return log.location;
    const ip = String(log.ip_address || "");
    if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127.")) {
      return "Internal";
    }
    return "Unknown";
  };

  const resolveResource = (log) => log.resource || log.action || log.message?.split(" ")[0] || "-";

  return (
    <section className="card data-table-card">
      <div className="table-toolbar">
        <label className="search-input">
          <Icon name="search" size={16} />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by user, IP, action, or resource..."
          />
        </label>

        <div className="toolbar-actions">
          <div className="select-wrap">
            <Icon name="filter" size={14} />
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
              <option value="all">All Risks</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="select-wrap">
            <select value={timeRange} onChange={(event) => setTimeRange(event.target.value)}>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <button type="button" className="ghost-btn" onClick={onExport}>
            <Icon name="download" size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>IP Address</th>
              <th>Location</th>
              <th>Resource</th>
              <th>Risk Level</th>
              <th>MITRE ID</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={8}>No matching records found.</td>
              </tr>
            ) : (
              paginatedLogs.map((log, index) => (
                <tr key={`${log.id || log.timestamp}-${index}`}>
                  <td>{formatTimestamp(log.timestamp)}</td>
                  <td>{log.username || log.user_id || "system"}</td>
                  <td>{log.action || log.message || "-"}</td>
                  <td>{log.ip_address || "-"}</td>
                  <td>{resolveLocation(log)}</td>
                  <td>{resolveResource(log)}</td>
                  <td>
                    <span className={`pill ${log.risk_level || "low"}`}>{log.risk_level || "low"}</span>
                  </td>
                  <td>{log.mitre_technique_id || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span>Showing {(safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} entries</span>
        <div className="pagination">
          <button
            type="button"
            className="page-btn"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={safePage === 1}
          >
            <Icon name="chevron-left" size={14} />
          </button>
          {pageList.map((item) => (
            <button
              key={`page-${item}`}
              type="button"
              className={`page-btn ${item === safePage ? "active" : ""}`}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className="page-btn"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safePage === totalPages}
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
