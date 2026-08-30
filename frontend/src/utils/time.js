const OFFSET_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i;

export function parseApiTimestamp(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  if (!OFFSET_PATTERN.test(normalized)) {
    normalized = `${normalized}Z`;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatTimestamp(value, options = {}) {
  const parsed = parseApiTimestamp(value);
  if (!parsed) {
    return "N/A";
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
    ...options,
  });

  return formatter.format(parsed);
}

export function floatHourToClock(floatHour) {
  const safe = Number.isFinite(Number(floatHour)) ? Number(floatHour) : 0;
  const wholeHour = Math.floor(safe) % 24;
  const minute = Math.round((safe - Math.floor(safe)) * 60);

  const date = new Date();
  date.setHours(wholeHour, minute, 0, 0);

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
