import {
  httpRequestsTotal,
  httpRequestDuration,
} from "./metrics.js";
import {
  recordApiRequest,
  getEventLoopStats,
} from "./runtimeMonitor.js";
import { getDatabasePoolStats } from "../config/prisma/PrismaService.js";
import logger from "./logger.js";

const SLOW_REQUEST_THRESHOLD_MS = Number(
  process.env.SLOW_REQUEST_THRESHOLD_MS || 1000,
);

export function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationSeconds = Number(durationNs) / 1e9;
    const durationMs = Number(durationNs) / 1e6;

    const route = req.baseUrl
      ? `${req.baseUrl}${req.route?.path || ""}`
      : req.route?.path || req.path || "unknown";

    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);

    // Skip health/metrics endpoints from skewing API business percentiles
    const isInternalProbe =
      req.path === "/metrics" ||
      req.path === "/livez" ||
      req.path === "/readyz" ||
      req.path.startsWith("/health") ||
      req.path.startsWith("/api/v1/health");

    if (!isInternalProbe) {
      recordApiRequest({
        method: req.method,
        route: req.originalUrl || route,
        status: res.statusCode,
        durationMs,
      });
    }

    // Correlate slow requests with DB Pool & Event Loop state
    if (durationMs >= SLOW_REQUEST_THRESHOLD_MS && !isInternalProbe) {
      const dbPool = getDatabasePoolStats();
      const eventLoop = getEventLoopStats(false);
      const roundedDuration = Math.round(durationMs);

      logger.warn(
        {
          metric: "slow_request",
          method: req.method,
          route: req.originalUrl || route,
          status: res.statusCode,
          duration_ms: roundedDuration,
          pool_total: dbPool.total,
          pool_idle: dbPool.idle,
          pool_waiting: dbPool.waiting,
          pool_max: dbPool.max,
          event_loop_utilization: eventLoop.utilization,
          event_loop_lag_p95: eventLoop.lagP95,
          event_loop_lag_max: eventLoop.lagMax,
        },
        `Slow request: ${req.method} ${req.originalUrl || route} status=${res.statusCode} duration=${roundedDuration}ms`,
      );
    }
  });

  next();
}