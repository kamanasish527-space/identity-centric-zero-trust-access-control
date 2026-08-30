import { useEffect, useMemo, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography, Graticule, Line, Marker, Sphere } from "react-simple-maps";

import worldMapUrl from "world-atlas/countries-110m.json?url";
import { parseApiTimestamp } from "../../utils/time";

const SERVER_NODE = {
  name: "Primary Auth Gateway",
  coordinates: [-122.4194, 37.7749],
};

const SEVERITY_COLORS = {
  normal: "#22c55e",
  suspicious: "#eab308",
  malicious: "#ef4444",
};

const LOCATION_HINTS = {
  "US-CA-SFO": [-122.4194, 37.7749],
  "US-VA-ASHBURN": [-77.4874, 39.0438],
  "US-NY-NYC": [-74.006, 40.7128],
  "GB-LON-LONDON": [-0.1278, 51.5072],
  "DE-BE-BERLIN": [13.405, 52.52],
  "IN-KA-BENGALURU": [77.5946, 12.9716],
  "SG-SIN-SINGAPORE": [103.8198, 1.3521],
  "JP-13-TOKYO": [139.6917, 35.6895],
  "BR-SP-SAO-PAULO": [-46.6333, -23.5505],
  "ZA-GP-JOHANNESBURG": [28.0473, -26.2041],
  "AU-NSW-SYDNEY": [151.2093, -33.8688],
  "RU-MOW-MOSCOW": [37.6173, 55.7558],
};

const SIM_TRAFFIC_NODES = [
  { location: "US-CA-SFO", coordinates: [-122.4194, 37.7749] },
  { location: "US-NY-NYC", coordinates: [-74.006, 40.7128] },
  { location: "GB-LON-LONDON", coordinates: [-0.1278, 51.5072] },
  { location: "DE-BE-BERLIN", coordinates: [13.405, 52.52] },
  { location: "IN-KA-BENGALURU", coordinates: [77.5946, 12.9716] },
  { location: "SG-SIN-SINGAPORE", coordinates: [103.8198, 1.3521] },
  { location: "JP-13-TOKYO", coordinates: [139.6917, 35.6895] },
  { location: "BR-SP-SAO-PAULO", coordinates: [-46.6333, -23.5505] },
  { location: "ZA-GP-JOHANNESBURG", coordinates: [28.0473, -26.2041] },
  { location: "AU-NSW-SYDNEY", coordinates: [151.2093, -33.8688] },
  { location: "RU-MOW-MOSCOW", coordinates: [37.6173, 55.7558] },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toSeed(input) {
  let hash = 2166136261;
  const str = String(input || "seed");
  for (let idx = 0; idx < str.length; idx += 1) {
    hash ^= str.charCodeAt(idx);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) || 1;
}

function createSeededRandom(seed) {
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }
  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function severityFromRisk(score) {
  const safeScore = Number(score || 0);
  if (safeScore >= 71) {
    return "malicious";
  }
  if (safeScore >= 31) {
    return "suspicious";
  }
  return "normal";
}

function normalizeLocation(location) {
  return String(location || "").trim().toUpperCase();
}

function coordinatesFromLocation(location) {
  const normalized = normalizeLocation(location);
  if (!normalized) {
    return null;
  }

  if (LOCATION_HINTS[normalized]) {
    return LOCATION_HINTS[normalized];
  }

  const hintKey = Object.keys(LOCATION_HINTS).find((key) => normalized.includes(key));
  if (hintKey) {
    return LOCATION_HINTS[hintKey];
  }

  return null;
}

function coordinatesFromIp(ipAddress) {
  const ip = String(ipAddress || "");
  if (!ip) {
    return null;
  }

  if (ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    const random = createSeededRandom(toSeed(ip));
    return [-122.4194 + (random() - 0.5) * 2.8, 37.7749 + (random() - 0.5) * 1.8];
  }

  const random = createSeededRandom(toSeed(ip));
  const longitude = (random() * 340) - 170;
  const latitude = (random() * 120) - 60;
  return [Number(longitude.toFixed(4)), Number(latitude.toFixed(4))];
}

function formatIsoTimestamp(value) {
  const date = parseApiTimestamp(value) || new Date();
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

function buildRealEvents(logs, sessions) {
  const locationByIp = new Map(
    (sessions || [])
      .filter((session) => session?.ip_address)
      .map((session) => [session.ip_address, session.location || ""])
  );

  const events = (logs || [])
    .filter((log) => Boolean(log?.ip_address))
    .map((log, index) => {
      const riskScore = clamp(Number(log?.risk_score || 0), 0, 100);
      const location = locationByIp.get(log.ip_address) || "";
      const coordinates = coordinatesFromLocation(location) || coordinatesFromIp(log.ip_address);
      return {
        id: `log-${log.id || index}-${log.timestamp}`,
        ipAddress: log.ip_address,
        riskScore,
        timestamp: parseApiTimestamp(log.timestamp) || new Date(),
        location: location || "Unknown",
        severity: severityFromRisk(riskScore),
        coordinates,
      };
    })
    .filter((event) => Array.isArray(event.coordinates))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 18);

  return events;
}

function buildSimulatedEvents(tickSeed, count) {
  const random = createSeededRandom(toSeed(`sim-${tickSeed}`));
  const events = [];
  const now = Date.now();

  for (let index = 0; index < count; index += 1) {
    const node = SIM_TRAFFIC_NODES[Math.floor(random() * SIM_TRAFFIC_NODES.length)];
    const jitterLon = (random() - 0.5) * 1.5;
    const jitterLat = (random() - 0.5) * 1.1;
    const riskScore = clamp(Math.round(random() * 100), 0, 100);
    const timestamp = new Date(now - index * 45000);
    events.push({
      id: `sim-${tickSeed}-${index}`,
      ipAddress: `${Math.floor(random() * 223) + 1}.${Math.floor(random() * 255)}.${Math.floor(random() * 255)}.${Math.floor(random() * 255)}`,
      riskScore,
      timestamp,
      location: node.location,
      severity: severityFromRisk(riskScore),
      coordinates: [
        Number((node.coordinates[0] + jitterLon).toFixed(4)),
        Number((node.coordinates[1] + jitterLat).toFixed(4)),
      ],
    });
  }

  return events;
}

export default function GlobalThreatMap({ logs = [], sessions = [] }) {
  const [tick, setTick] = useState(0);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState("");
  const [countryTooltip, setCountryTooltip] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [projectionRotation, setProjectionRotation] = useState([0, 0, 0]);
  const stageRef = useRef(null);
  const targetRotationRef = useRef([0, 0]);
  const currentRotationRef = useRef([0, 0]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick((prev) => prev + 1);
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const realEvents = useMemo(() => buildRealEvents(logs, sessions), [logs, sessions]);

  const ambientEvents = useMemo(() => buildSimulatedEvents(tick + 991, 7), [tick]);

  const events = useMemo(() => {
    const liveEvents = realEvents.length >= 4
      ? realEvents.slice(0, 12)
      : [...realEvents, ...buildSimulatedEvents(tick, 12 - realEvents.length)];
    return [...liveEvents, ...ambientEvents].slice(0, 18);
  }, [ambientEvents, realEvents, tick]);

  const usingSimulation = realEvents.length < 6;

  const currentSessionPoint = useMemo(() => {
    const candidates = (sessions || [])
      .filter((item) => Boolean(item?.location || item?.ip_address))
      .sort((a, b) => {
        const aTime = parseApiTimestamp(a?.issued_at)?.getTime() || 0;
        const bTime = parseApiTimestamp(b?.issued_at)?.getTime() || 0;
        return bTime - aTime;
      });

    const latest = candidates.find((item) => item?.is_active) || candidates[0];
    if (!latest) {
      return null;
    }

    const coordinates =
      coordinatesFromLocation(latest.location) ||
      coordinatesFromIp(latest.ip_address);
    if (!coordinates) {
      return null;
    }

    return {
      coordinates,
      location: latest.location || "Unknown Location",
      ipAddress: latest.ip_address || "-",
      issuedAt: latest.issued_at || new Date().toISOString(),
    };
  }, [sessions]);

  const updateTooltipPosition = (evt) => {
    if (!stageRef.current) {
      return;
    }
    const rect = stageRef.current.getBoundingClientRect();
    const pointerX = Number.isFinite(evt?.clientX) ? evt.clientX : rect.left + rect.width * 0.5;
    const pointerY = Number.isFinite(evt?.clientY) ? evt.clientY : rect.top + rect.height * 0.5;
    const x = clamp(pointerX - rect.left + 14, 12, rect.width - 230);
    const y = clamp(pointerY - rect.top + 14, 12, rect.height - 120);
    setTooltipPosition({ x, y });
  };

  const updateCountryTooltip = (name, evt) => {
    if (!stageRef.current) {
      return;
    }
    const rect = stageRef.current.getBoundingClientRect();
    const pointerX = Number.isFinite(evt?.clientX) ? evt.clientX : rect.left + rect.width * 0.5;
    const pointerY = Number.isFinite(evt?.clientY) ? evt.clientY : rect.top + rect.height * 0.5;
    const x = clamp(pointerX - rect.left + 18, 12, rect.width - 220);
    const y = clamp(pointerY - rect.top - 16, 8, rect.height - 40);
    setCountryTooltip({ name, x, y });
  };

  const handleMapMouseMove = (evt) => {
    if (!stageRef.current) {
      return;
    }
    const rect = stageRef.current.getBoundingClientRect();
    const ratioX = clamp((evt.clientX - rect.left) / rect.width, 0, 1);
    const ratioY = clamp((evt.clientY - rect.top) / rect.height, 0, 1);
    const nx = ratioX - 0.5;
    const ny = ratioY - 0.5;
    targetRotationRef.current = [-(nx * 28), ny * 18];
  };

  useEffect(() => {
    let rafId = null;
    const animate = () => {
      const [tx, ty] = targetRotationRef.current;
      const [cx, cy] = currentRotationRef.current;
      const nextX = cx + (tx - cx) * 0.085;
      const nextY = cy + (ty - cy) * 0.085;
      currentRotationRef.current = [nextX, nextY];
      setProjectionRotation([nextX, nextY, 0]);
      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return (
    <article className="chart-card world-map-card">
      <div className="chart-card-head">
        <h4>Global Access Map</h4>
        <span className="chip">{usingSimulation ? "Telemetry + Simulated Traffic" : "Live Telemetry"}</span>
      </div>

      <div className="world-map-legend">
        <span><i className="dot normal" /> Normal</span>
        <span><i className="dot suspicious" /> Suspicious</span>
        <span><i className="dot malicious" /> Malicious</span>
      </div>

      <div
        className="world-map-stage"
        ref={stageRef}
        onMouseMove={handleMapMouseMove}
        onMouseLeave={() => {
          setHoveredEvent(null);
          setHoveredCountry("");
          setCountryTooltip(null);
          targetRotationRef.current = [0, 0];
        }}
      >
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ rotate: projectionRotation, scale: 185 }}
          className="world-map-svg"
        >
          <Sphere fill="rgba(10, 15, 26, 0.9)" stroke="rgba(148, 163, 184, 0.16)" strokeWidth={0.4} />
          <Graticule stroke="rgba(148, 163, 184, 0.12)" strokeWidth={0.45} />
          <Geographies geography={worldMapUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="rgba(30, 41, 59, 0.72)"
                  stroke="rgba(148, 163, 184, 0.22)"
                  strokeWidth={0.4}
                  onMouseEnter={(evt) => {
                    const name = geo?.properties?.NAME_LONG || geo?.properties?.NAME || "";
                    setHoveredCountry(name);
                    updateCountryTooltip(name, evt);
                  }}
                  onMouseMove={(evt) => {
                    const name = geo?.properties?.NAME_LONG || geo?.properties?.NAME || "";
                    updateCountryTooltip(name, evt);
                  }}
                  onMouseLeave={() => {
                    setHoveredCountry("");
                    setCountryTooltip(null);
                  }}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: "rgba(99, 102, 241, 0.25)" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {events.map((event) => (
            <Line
              key={`line-${event.id}`}
              from={event.coordinates}
              to={SERVER_NODE.coordinates}
              stroke={SEVERITY_COLORS[event.severity]}
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeOpacity={0.7}
              className={`world-map-trace ${event.severity}`}
            />
          ))}

          <Marker coordinates={SERVER_NODE.coordinates}>
            <g className="world-map-server-marker">
              <circle r={5.5} />
              <circle r={10.5} className="server-pulse" />
            </g>
          </Marker>

          {currentSessionPoint && (
            <>
              <Line
                from={currentSessionPoint.coordinates}
                to={SERVER_NODE.coordinates}
                stroke="#2fd8ff"
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeDasharray="2 3"
                className="world-map-trace current-user"
              />
              <Marker coordinates={currentSessionPoint.coordinates}>
                <g className="world-map-marker current-user">
                  <circle r={12} className="map-ping" />
                  <circle r={4.5} className="map-core" />
                </g>
              </Marker>
            </>
          )}

          {events.map((event) => (
            <Marker
              key={event.id}
              coordinates={event.coordinates}
              onMouseEnter={(evt) => {
                updateTooltipPosition(evt);
                setHoveredEvent(event);
              }}
              onMouseMove={updateTooltipPosition}
              onFocus={(evt) => {
                updateTooltipPosition(evt);
                setHoveredEvent(event);
              }}
            >
              <g className={`world-map-marker ${event.severity}`}>
                <circle r={10} className="map-ping" />
                <circle r={3.6} className="map-core" />
              </g>
            </Marker>
          ))}
        </ComposableMap>

        {hoveredEvent && (
          <aside
            className="world-map-tooltip"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
            }}
          >
            <strong>{hoveredEvent.location}</strong>
            <span>IP: {hoveredEvent.ipAddress}</span>
            <span>Risk: {hoveredEvent.riskScore}</span>
            <span>Time: {formatIsoTimestamp(hoveredEvent.timestamp)}</span>
          </aside>
        )}

        {countryTooltip?.name && (
          <aside
            className="world-map-country-tooltip"
            style={{
              left: `${countryTooltip.x}px`,
              top: `${countryTooltip.y}px`,
            }}
          >
            {countryTooltip.name}
          </aside>
        )}

        <div className="world-map-country-label">
          {hoveredCountry ? `Country: ${hoveredCountry}` : "Move cursor over map to inspect country boundaries"}
        </div>
      </div>
    </article>
  );
}
