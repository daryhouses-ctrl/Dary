import cron from "node-cron";
import logger from "../../observability/logger.js";
import { getDatabasePoolStats } from "../../config/prisma/PrismaService.js";
import {
  getEventLoopStats,
  getApiPerformanceStats,
} from "../../observability/runtimeMonitor.js";
import * as Sentry from "@sentry/node";

// Track consecutive minutes with DB pool waiting > 0
let consecutivePoolWaitingMinutes = 0;

/**
 * Evaluates current metrics against Production Alert thresholds:
 * 1. API p95 > 1000ms
 * 2. DB pool waiting > 0 for several minutes (>= 2 consecutive minutes, or immediate high queue)
 * 3. API error rate > 5%
 * 4. Event Loop lag > 200ms
 */
export function evaluateProductionAlerts({ dbStats, eluStats, apiStats }) {
  const alerts = [];

  if (apiStats.p95 > 1000) {
    alerts.push({
      code: "API_P95_HIGH",
      message: `API p95 latency is ${apiStats.p95}ms (> 1000ms threshold)`,
      value: apiStats.p95,
      threshold: 1000,
    });
  }

  if (dbStats.waiting > 0 && consecutivePoolWaitingMinutes >= 2) {
    alerts.push({
      code: "DB_POOL_WAITING_SUSTAINED",
      message: `DB pool has ${dbStats.waiting} waiting requests for ${consecutivePoolWaitingMinutes} consecutive minutes`,
      value: dbStats.waiting,
      consecutiveMinutes: consecutivePoolWaitingMinutes,
    });
  }

  if (apiStats.requests >= 5 && apiStats.errorRate > 5) {
    alerts.push({
      code: "API_ERROR_RATE_HIGH",
      message: `API error rate is ${apiStats.errorRate}% (> 5% threshold, ${apiStats.errors}/${apiStats.requests} requests)`,
      value: apiStats.errorRate,
      threshold: 5,
    });
  }

  if (eluStats.lagP95 > 200 || eluStats.lagMax > 200) {
    alerts.push({
      code: "EVENT_LOOP_LAG_HIGH",
      message: `Node.js Event Loop lag is high (p95=${eluStats.lagP95}ms, max=${eluStats.lagMax}ms > 200ms threshold)`,
      value: Math.max(eluStats.lagP95, eluStats.lagMax),
      threshold: 200,
    });
  }

  return alerts;
}

/**
 * Periodically monitors the 3 production observability pillars every minute:
 * 1. PostgreSQL Connection Pool (total, idle, waiting, max)
 * 2. Node.js Event Loop (utilization, lag_p95, lag_max)
 * 3. API Performance (requests, errors, error_rate, p50, p95, p99, slowest_endpoints)
 * 4. Proactive Production Alerts (Pino + Sentry)
 */
export function startPoolMonitorJob() {
  cron.schedule("* * * * *", () => {
    try {
      // 1. PostgreSQL Pool Metrics (Structured Pino JSON)
      const dbStats = getDatabasePoolStats();

      if (dbStats.waiting > 0) {
        consecutivePoolWaitingMinutes += 1;
      } else {
        consecutivePoolWaitingMinutes = 0;
      }

      logger.info(
        {
          metric: "database_pool",
          pool_total: dbStats.total,
          pool_idle: dbStats.idle,
          pool_waiting: dbStats.waiting,
          pool_max: dbStats.max,
        },
        `DB_POOL total=${dbStats.total} idle=${dbStats.idle} waiting=${dbStats.waiting} max=${dbStats.max}`,
      );

      if (
        dbStats.waiting > 0 ||
        (dbStats.total > 0 && dbStats.idle === 0)
      ) {
        logger.warn(
          {
            metric: "database_pool_pressure",
            pool_total: dbStats.total,
            pool_idle: dbStats.idle,
            pool_waiting: dbStats.waiting,
            pool_max: dbStats.max,
            consecutive_waiting_minutes: consecutivePoolWaitingMinutes,
          },
          `⚠️ DB pool pressure total=${dbStats.total} idle=${dbStats.idle} waiting=${dbStats.waiting} max=${dbStats.max}`,
        );
      }

      // 2. Node.js Event Loop Metrics (Structured Pino JSON)
      const eluStats = getEventLoopStats(true);

      logger.info(
        {
          metric: "event_loop",
          utilization: eluStats.utilization,
          lag_p95: eluStats.lagP95,
          lag_max: eluStats.lagMax,
        },
        `EVENT_LOOP utilization=${eluStats.utilization}% lag_p95=${eluStats.lagP95}ms lag_max=${eluStats.lagMax}ms`,
      );

      // 3. API Performance Metrics (Structured Pino JSON)
      const apiStats = getApiPerformanceStats();

      logger.info(
        {
          metric: "api_performance",
          requests: apiStats.requests,
          errors: apiStats.errors,
          error_rate: apiStats.errorRate,
          p50: apiStats.p50,
          p95: apiStats.p95,
          p99: apiStats.p99,
          slowest_endpoints: apiStats.slowestEndpoints,
        },
        `API METRICS requests=${apiStats.requests} errors=${apiStats.errors} (${apiStats.errorRate}%) p50=${apiStats.p50}ms p95=${apiStats.p95}ms p99=${apiStats.p99}ms`,
      );

      // 4. Evaluate Proactive Production Alerts
      const triggeredAlerts = evaluateProductionAlerts({
        dbStats,
        eluStats,
        apiStats,
      });

      for (const alert of triggeredAlerts) {
        logger.warn(
          {
            metric: "production_alert",
            alert_code: alert.code,
            alert_value: alert.value,
            alert_threshold: alert.threshold,
            db_pool: dbStats,
            event_loop: eluStats,
            api: {
              requests: apiStats.requests,
              errors: apiStats.errors,
              error_rate: apiStats.errorRate,
              p50: apiStats.p50,
              p95: apiStats.p95,
              p99: apiStats.p99,
            },
          },
          `🚨 ALERT [${alert.code}]: ${alert.message}`,
        );

        if (process.env.NODE_ENV === "production") {
          Sentry.withScope((scope) => {
            scope.setTag("alert_code", alert.code);
            scope.setContext("database_pool", dbStats);
            scope.setContext("event_loop", eluStats);
            scope.setContext("api_performance", apiStats);
            Sentry.captureMessage(
              `[Dary Alert] ${alert.code}: ${alert.message}`,
              "warning",
            );
          });
        }
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to collect runtime observability metrics");
    }
  });

  logger.info(
    "Runtime observability monitor scheduled (every 1 minute: database_pool, event_loop, api_performance, alerts).",
  );
}


