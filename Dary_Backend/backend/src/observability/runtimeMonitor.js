import { performance, monitorEventLoopDelay } from "node:perf_hooks";

const MAX_SAMPLES = 10000;
const WINDOW_MS = 60 * 1000; // 1-minute rolling window for real-time percentiles

// 1. Node.js Event Loop Monitoring (Built-in perf_hooks)
const loopDelayHistogram = monitorEventLoopDelay({ resolution: 10 });
loopDelayHistogram.enable();

let previousElu = performance.eventLoopUtilization();
let lastMinuteEventLoopStats = {
  utilization: 0,
  lagP95: 0,
  lagMax: 0,
};

export function getEventLoopStats(resetWindow = false) {
  const currentElu = performance.eventLoopUtilization();
  const deltaElu = performance.eventLoopUtilization(currentElu, previousElu);

  const rawUtilization = Number((deltaElu.utilization * 100).toFixed(1));

  // monitorEventLoopDelay records in nanoseconds; convert to milliseconds
  const p95Ns = loopDelayHistogram.percentile(95);
  const maxNs = loopDelayHistogram.max;

  const lagP95 =
    Number.isFinite(p95Ns) && p95Ns > 0
      ? Number((p95Ns / 1e6).toFixed(1))
      : lastMinuteEventLoopStats.lagP95;

  const lagMax =
    Number.isFinite(maxNs) && maxNs > 0 && maxNs < 1e15
      ? Number((maxNs / 1e6).toFixed(1))
      : lastMinuteEventLoopStats.lagMax;

  const stats = {
    utilization: Number.isFinite(rawUtilization)
      ? rawUtilization
      : lastMinuteEventLoopStats.utilization,
    lagP95,
    lagMax,
  };

  if (resetWindow) {
    previousElu = currentElu;
    loopDelayHistogram.reset();
    lastMinuteEventLoopStats = stats;
  }

  return stats;
}

// 2. API Performance Metrics (p50, p95, p99, requests, errors, errorRate, slowestEndpoints)
const apiSamples = [];
let totalWindowRequests = 0;
let totalWindowErrors = 0;
let totalWindowClientErrors = 0;

/**
 * Normalizes dynamic URLs (UUIDs, numeric IDs, query strings) for clean endpoint grouping.
 * e.g. "/api/v1/properties/550e8400-e29b...?page=1" -> "/properties/:id"
 */
export function normalizeEndpointRoute(rawUrl = "") {
  const withoutQuery = rawUrl.split("?")[0] || "/";
  const strippedPrefix = withoutQuery.replace(/^\/api\/v\d+/, "") || "/";
  return strippedPrefix
    .replace(
      /\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
      "/:id",
    )
    .replace(/\/\d+/g, "/:id");
}

function pruneOldSamples(now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  while (apiSamples.length > 0 && apiSamples[0].timestamp < cutoff) {
    const removed = apiSamples.shift();
    totalWindowRequests = Math.max(0, totalWindowRequests - 1);
    if (removed.isError) {
      totalWindowErrors = Math.max(0, totalWindowErrors - 1);
    }
    if (removed.isClientError) {
      totalWindowClientErrors = Math.max(0, totalWindowClientErrors - 1);
    }
  }
}

/**
 * Records a completed HTTP request duration and status.
 * Note: Only 5xx server errors count toward `isError` / `errorRate` for production outage alerts,
 * while 4xx client errors (400/401/403/404) are tracked in `clientErrors`.
 */
export function recordApiRequest({ method, route, status, durationMs }) {
  const now = Date.now();
  pruneOldSamples(now);

  const isError = status >= 500;
  const isClientError = status >= 400 && status < 500;
  const roundedDuration = Number(durationMs.toFixed(2));
  const normalizedEndpoint = normalizeEndpointRoute(route);

  apiSamples.push({
    timestamp: now,
    durationMs: roundedDuration,
    isError,
    isClientError,
    method,
    route,
    endpoint: normalizedEndpoint,
    status,
  });

  totalWindowRequests += 1;
  if (isError) {
    totalWindowErrors += 1;
  }
  if (isClientError) {
    totalWindowClientErrors += 1;
  }

  if (apiSamples.length > MAX_SAMPLES) {
    const oldest = apiSamples.shift();
    totalWindowRequests = Math.max(0, totalWindowRequests - 1);
    if (oldest.isError) {
      totalWindowErrors = Math.max(0, totalWindowErrors - 1);
    }
    if (oldest.isClientError) {
      totalWindowClientErrors = Math.max(0, totalWindowClientErrors - 1);
    }
  }
}

/**
 * Calculates a given percentile (0-100) from a sorted numeric array.
 */
function calculatePercentile(sortedValues, percentile) {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  const clampedIndex = Math.max(0, Math.min(sortedValues.length - 1, index));
  return Math.round(sortedValues[clampedIndex]);
}

/**
 * Returns p50, p95, p99 (in ms), request count, error count (5xx), clientErrors (4xx), errorRate (%),
 * and top slowest endpoints over the active window.
 */
export function getApiPerformanceStats(topN = 5) {
  pruneOldSamples(Date.now());

  if (apiSamples.length === 0) {
    return {
      requests: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      errors: 0,
      clientErrors: 0,
      errorRate: 0,
      slowestEndpoints: [],
    };
  }

  const sortedDurations = apiSamples
    .map((s) => s.durationMs)
    .sort((a, b) => a - b);

  const errorRate =
    totalWindowRequests > 0
      ? Number(((totalWindowErrors / totalWindowRequests) * 100).toFixed(1))
      : 0;

  // Group by normalized endpoint to find the slowest routes (by p95)
  const byEndpoint = new Map();
  for (const sample of apiSamples) {
    const key = sample.endpoint || "/";
    if (!byEndpoint.has(key)) {
      byEndpoint.set(key, []);
    }
    byEndpoint.get(key).push(sample.durationMs);
  }

  const slowestEndpoints = Array.from(byEndpoint.entries())
    .map(([endpoint, durations]) => {
      const sorted = durations.slice().sort((a, b) => a - b);
      const p50 = calculatePercentile(sorted, 50);
      const p95 = calculatePercentile(sorted, 95);
      const p99 = calculatePercentile(sorted, 99);
      return {
        endpoint,
        requests: sorted.length,
        p50,
        p95,
        p99,
      };
    })
    .sort((a, b) => b.p95 - a.p95)
    .slice(0, topN);

  return {
    requests: totalWindowRequests,
    p50: calculatePercentile(sortedDurations, 50),
    p95: calculatePercentile(sortedDurations, 95),
    p99: calculatePercentile(sortedDurations, 99),
    errors: totalWindowErrors,
    clientErrors: totalWindowClientErrors,
    errorRate,
    slowestEndpoints,
  };
}
