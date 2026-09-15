export function isoFromMilliseconds(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

export function normalizeCallTiming(call, fallbackIso = new Date().toISOString()) {
  const startedAt = isoFromMilliseconds(call.start_timestamp);
  const endedAt = isoFromMilliseconds(call.end_timestamp);
  if (startedAt === undefined || endedAt === undefined) return null;
  if (startedAt && endedAt && endedAt < startedAt) return null;
  return {
    startedAt: startedAt || fallbackIso,
    endedAt,
    durationSeconds:
      startedAt && endedAt
        ? Math.max(0, Math.round((call.end_timestamp - call.start_timestamp) / 1000))
        : null,
  };
}
