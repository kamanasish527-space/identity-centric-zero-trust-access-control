import { useEffect, useMemo, useState } from "react";

import { Card } from "../components/ui/card";
import { Search, Filter, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useDashboard } from "../store/dashboardStore";
import { formatTimestamp, parseApiTimestamp } from "../utils/time";

const ITEMS_PER_PAGE = 10;

function normalize(value) {
  return String(value || "").toLowerCase();
}

function resolveLocation(log) {
  if (log.location) {
    return log.location;
  }
  const ip = String(log.ip_address || "");
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127.")) {
    return "Internal";
  }
  return "Unknown";
}

function resolveResource(log) {
  return log.resource || log.action || log.message?.split(" ")[0] || "-";
}

export default function DataDetails() {
  const dashboard = useDashboard();
  const [currentPage, setCurrentPage] = useState(1);
  const [filterRisk, setFilterRisk] = useState("all");
  const [timeRange, setTimeRange] = useState("24h");
  const [search, setSearch] = useState("");

  const filteredLogs = useMemo(() => {
    const query = normalize(search).trim();
    const now = Date.now();
    const rangeMs =
      timeRange === "1h"
        ? 60 * 60 * 1000
        : timeRange === "24h"
        ? 24 * 60 * 60 * 1000
        : timeRange === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : timeRange === "30d"
        ? 30 * 24 * 60 * 60 * 1000
        : null;

    return (dashboard.logs || []).filter((log) => {
      if (filterRisk !== "all" && String(log.risk_level || "").toLowerCase() !== filterRisk) {
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

      const fields = [
        log.timestamp,
        log.username,
        log.user_id,
        log.action,
        log.message,
        log.ip_address,
        log.device_id,
        log.mitre_technique_id,
        log.mitre_technique_name,
        log.resource,
      ]
        .map((item) => normalize(item))
        .join(" ");

      return fields.includes(query);
    });
  }, [dashboard.logs, filterRisk, search, timeRange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterRisk, search, timeRange]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl text-gray-100 mb-1">Data Details</h2>
        <p className="text-sm text-gray-500">Complete activity logs and security events</p>
      </div>

      <Card className="p-4 bg-gray-900 border-gray-800">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by user, IP, action, or resource..."
              className="pl-10 bg-gray-800 border-gray-700 text-gray-300 placeholder:text-gray-500"
            />
          </div>

          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-gray-300">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risks</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-gray-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
            onClick={dashboard.actions.exportLogs}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </Card>

      <Card className="bg-gray-900 border-gray-800">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-800/50 hover:bg-gray-800/50 border-gray-800">
                <TableHead className="text-gray-400 font-medium">Timestamp</TableHead>
                <TableHead className="text-gray-400 font-medium">User</TableHead>
                <TableHead className="text-gray-400 font-medium">Action</TableHead>
                <TableHead className="text-gray-400 font-medium">IP Address</TableHead>
                <TableHead className="text-gray-400 font-medium">Location</TableHead>
                <TableHead className="text-gray-400 font-medium">Resource</TableHead>
                <TableHead className="text-gray-400 font-medium">Risk Level</TableHead>
                <TableHead className="text-gray-400 font-medium">MITRE ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLogs.length === 0 ? (
                <TableRow className="border-gray-800">
                  <TableCell colSpan={8} className="text-center text-gray-500">
                    No matching records found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map((log, index) => (
                  <TableRow key={`${log.id || log.timestamp}-${index}`} className="border-gray-800 hover:bg-gray-800/30">
                    <TableCell className="text-sm text-gray-400 font-mono">
                      {formatTimestamp(log.timestamp)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-300">{log.username || log.user_id || "system"}</TableCell>
                    <TableCell className="text-sm text-gray-300">{log.action || log.message || "-"}</TableCell>
                    <TableCell className="text-sm text-gray-400 font-mono">{log.ip_address || "-"}</TableCell>
                    <TableCell className="text-sm text-gray-400">{resolveLocation(log)}</TableCell>
                    <TableCell className="text-sm text-gray-400 max-w-xs truncate">{resolveResource(log)}</TableCell>
                    <TableCell className="text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          log.risk_level === "critical"
                            ? "bg-red-500/20 text-red-400"
                            : log.risk_level === "high"
                            ? "bg-amber-500/20 text-amber-400"
                            : log.risk_level === "medium"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-cyan-500/20 text-cyan-400"
                        }`}
                      >
                        {log.risk_level || "low"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-400 font-mono">{log.mitre_technique_id || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
          <div className="text-sm text-gray-500">
            Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length} entries
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={
                    page === currentPage
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700"
                  }
                >
                  {page}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
