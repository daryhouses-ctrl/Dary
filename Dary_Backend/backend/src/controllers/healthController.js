import {
  checkDatabase,
  checkRedis,
  getMemoryUsage,
} from "../services/healthService.js";
import { prisma, getDatabasePoolStats } from "../config/prisma/PrismaService.js";
import {
  getEventLoopStats,
  getApiPerformanceStats,
} from "../observability/runtimeMonitor.js";

/**
 * Helper to validate internal health/metrics token protection.
 * In production, HEALTH_SECRET_TOKEN is strictly required.
 * Accepts either `X-Health-Token: <token>` or `Authorization: Bearer <token>`.
 */
function isAuthorizedHealthRequest(req) {
  const secretToken = process.env.HEALTH_SECRET_TOKEN;
  const headerToken = req.headers["x-health-token"];
  const authHeader = req.headers["authorization"];
  const bearerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
  const providedToken = headerToken || bearerToken;

  if (process.env.NODE_ENV === "production") {
    return Boolean(secretToken && providedToken === secretToken);
  }

  if (secretToken) {
    return providedToken === secretToken;
  }

  return true;
}

/**
 * 1. Liveness Probe (/livez)
 * Answers: Is the Node.js process alive and responding to requests?
 * NEVER check database or external services here.
 */
export const getLiveness = (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
};

/**
 * 2. Readiness Probe (/readyz)
 * Answers: Can this server currently handle client traffic?
 * Checks critical dependencies (PostgreSQL via Prisma).
 * If critical check fails -> returns 503 (Load balancer drops this instance).
 */
export const getReadiness = async (req, res) => {
  try {
    const dbCheck = await checkDatabase(500);

    if (dbCheck.status !== "up") {
      return res.status(503).json({
        status: "not_ready",
        reason: "Database is unavailable",
        database: dbCheck,
      });
    }

    return res.status(200).json({
      status: "ready",
      database: dbCheck,
    });
  } catch (error) {
    return res.status(503).json({
      status: "not_ready",
      error: error.message || "Readiness check failed",
    });
  }
};

/**
 * 3. Deep Diagnostics (/health/deep)
 * Answers: Detailed breakdown of all dependencies, latency, and memory metrics.
 * Designed for Grafana dashboards, On-Call alerts, and internal monitoring.
 * Protected via X-Health-Token header in production.
 */
export const getDeepHealth = async (req, res) => {
  if (!isAuthorizedHealthRequest(req)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Invalid or missing X-Health-Token header",
    });
  }

  const [dbResult, redisResult] = await Promise.all([
    checkDatabase(500),
    checkRedis(500),
  ]);

  const isDbDown = dbResult.status !== "up";
  const isRedisDown = redisResult.status === "down";

  // Determine overall status
  let overallStatus = "healthy";
  if (isDbDown) {
    overallStatus = "unhealthy"; // Critical dependency is down
  } else if (isRedisDown) {
    overallStatus = "degraded"; // Non-critical cache is down
  }

  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  return res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      memory: getMemoryUsage(),
      eventLoop: getEventLoopStats(false),
    },
    api: getApiPerformanceStats(),
    dependencies: {
      database: {
        type: "PostgreSQL (Prisma)",
        isCritical: true,
        ...dbResult,
        pool: getDatabasePoolStats(),
      },
      redis: {
        type: "Redis Cache",
        isCritical: false,
        ...redisResult,
      },
    },
  });
};

/**
 * 4. Database Health & Connection Pool Monitor (/health/db)
 * Answers: Is the database connected, what is the latency, and what are pool metrics?
 * Total, idle, waiting, and max connections.
 * Public endpoint (no token required).
 */
export const getDbHealth = async (req, res) => {
  const start = performance.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = performance.now() - start;

    // Fetch PostgreSQL server-level stats (max_connections, used, other tools, available)
    let postgresServerStats = null;
    try {
      const serverResult = await prisma.$queryRawUnsafe(`
        SELECT 
          current_setting('max_connections')::int AS max_connections,
          count(*)::int AS total_used,
          count(*) FILTER (WHERE datname = current_database())::int AS app_connections,
          count(*) FILTER (WHERE datname != current_database() OR datname IS NULL)::int AS other_connections
        FROM pg_stat_activity
      `);

      if (serverResult && serverResult[0]) {
        const row = serverResult[0];
        const maxConn = Number(row.max_connections);
        const totalUsed = Number(row.total_used);
        const appConn = Number(row.app_connections);
        const otherConn = Number(row.other_connections);

        postgresServerStats = {
          max_connections: maxConn,
          total_used: totalUsed,
          app_connections: appConn,
          other_connections: otherConn,
          available_remaining: Math.max(0, maxConn - totalUsed),
        };
      }
    } catch {
      postgresServerStats = null;
    }

    return res.status(200).json({
      status: "healthy",
      database: {
        connected: true,
        latency_ms: Number(latency.toFixed(2)),
      },
      pool: getDatabasePoolStats(),
      ...(postgresServerStats ? { postgres_server: postgresServerStats } : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      status: "unhealthy",
      database: {
        connected: false,
      },
      pool: getDatabasePoolStats(),
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * 5. Unified Runtime Observability Metrics (/api/v1/health/metrics)
 * Answers: Is slowness coming from PostgreSQL Pool, Node.js Event Loop, or API/Network?
 * Protected via X-Health-Token (or Bearer token) in production.
 */
export const getHealthMetrics = (req, res) => {
  if (!isAuthorizedHealthRequest(req)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Invalid or missing X-Health-Token header",
    });
  }

  const database = getDatabasePoolStats();
  const eventLoop = getEventLoopStats(false);
  const api = getApiPerformanceStats();

  return res.status(200).json({
    database: {
      total: database.total,
      idle: database.idle,
      waiting: database.waiting,
      max: database.max,
    },
    eventLoop: {
      utilization: eventLoop.utilization,
      lagP95: eventLoop.lagP95,
      lagMax: eventLoop.lagMax,
    },
    api: {
      requests: api.requests,
      p50: api.p50,
      p95: api.p95,
      p99: api.p99,
      errors: api.errors,
      errorRate: api.errorRate,
      slowestEndpoints: api.slowestEndpoints,
    },
  });
};


