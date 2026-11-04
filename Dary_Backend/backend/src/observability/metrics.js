import client from "prom-client";
import { getDatabasePoolStats } from "../config/prisma/PrismaService.js";
import {
  getEventLoopStats,
  getApiPerformanceStats,
} from "./runtimeMonitor.js";

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

register.registerMetric(httpRequestsTotal);

// HTTP request duration
export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],

  buckets: [
    0.01,  // 10ms
    0.025, // 25ms
    0.05,  // 50ms
    0.1,   // 100ms
    0.25,  // 250ms
    0.5,   // 500ms
    1,      // 1s
    2.5,    // 2.5s
    5,      // 5s
    10,     // 10s
  ],
});

register.registerMetric(httpRequestDuration);

// PostgreSQL Connection Pool Gauges
export const dbPoolTotalGauge = new client.Gauge({
  name: "db_pool_connections_total",
  help: "Total connections in PostgreSQL pool",
  collect() {
    this.set(getDatabasePoolStats().total);
  },
});
register.registerMetric(dbPoolTotalGauge);

export const dbPoolIdleGauge = new client.Gauge({
  name: "db_pool_connections_idle",
  help: "Idle connections in PostgreSQL pool",
  collect() {
    this.set(getDatabasePoolStats().idle);
  },
});
register.registerMetric(dbPoolIdleGauge);

export const dbPoolWaitingGauge = new client.Gauge({
  name: "db_pool_connections_waiting",
  help: "Waiting requests in PostgreSQL pool",
  collect() {
    this.set(getDatabasePoolStats().waiting);
  },
});
register.registerMetric(dbPoolWaitingGauge);

export const dbPoolMaxGauge = new client.Gauge({
  name: "db_pool_connections_max",
  help: "Max connections configured for PostgreSQL pool",
  collect() {
    this.set(getDatabasePoolStats().max);
  },
});
register.registerMetric(dbPoolMaxGauge);

// Node.js Event Loop Gauges
export const eventLoopUtilizationGauge = new client.Gauge({
  name: "nodejs_event_loop_utilization_percent",
  help: "Node.js Event Loop utilization percentage",
  collect() {
    this.set(getEventLoopStats(false).utilization);
  },
});
register.registerMetric(eventLoopUtilizationGauge);

export const eventLoopLagP95Gauge = new client.Gauge({
  name: "nodejs_event_loop_lag_p95_ms",
  help: "Node.js Event Loop p95 lag in milliseconds",
  collect() {
    this.set(getEventLoopStats(false).lagP95);
  },
});
register.registerMetric(eventLoopLagP95Gauge);

export const eventLoopLagMaxGauge = new client.Gauge({
  name: "nodejs_event_loop_lag_max_ms",
  help: "Node.js Event Loop max lag in milliseconds",
  collect() {
    this.set(getEventLoopStats(false).lagMax);
  },
});
register.registerMetric(eventLoopLagMaxGauge);

// API Rolling Percentiles Gauges (1m window)
export const apiLatencyP50Gauge = new client.Gauge({
  name: "api_request_duration_p50_ms",
  help: "API request latency p50 in milliseconds (1m window)",
  collect() {
    this.set(getApiPerformanceStats().p50);
  },
});
register.registerMetric(apiLatencyP50Gauge);

export const apiLatencyP95Gauge = new client.Gauge({
  name: "api_request_duration_p95_ms",
  help: "API request latency p95 in milliseconds (1m window)",
  collect() {
    this.set(getApiPerformanceStats().p95);
  },
});
register.registerMetric(apiLatencyP95Gauge);

export const apiLatencyP99Gauge = new client.Gauge({
  name: "api_request_duration_p99_ms",
  help: "API request latency p99 in milliseconds (1m window)",
  collect() {
    this.set(getApiPerformanceStats().p99);
  },
});
register.registerMetric(apiLatencyP99Gauge);

export { register };