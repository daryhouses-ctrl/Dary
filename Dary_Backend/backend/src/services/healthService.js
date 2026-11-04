import { prisma } from "../config/prisma/PrismaService.js";
import Redis from "ioredis";

function withTimeout(promise, ms = 500) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Check exceeded ${ms}ms timeout`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

let redisHealthClient = null;
function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (!redisHealthClient) {
    redisHealthClient = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 500,
    });
  }
  return redisHealthClient;
}


export async function checkDatabase(timeoutMs = 500) {
  const start = performance.now();
  try {
    await withTimeout(prisma.$queryRawUnsafe("SELECT 1"), timeoutMs);
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: "up",
      latency: `${latencyMs}ms`,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: "down",
      latency: `${latencyMs}ms`,
      error: error.message || "Database check failed",
    };
  }
}


  // Check Redis connectivity
export async function checkRedis(timeoutMs = 500) {
  const redis = getRedisClient();
  if (!redis) {
    return {
      status: "skipped",
      reason: "REDIS_URL is not configured",
    };
  }

  const start = performance.now();
  try {
    if (redis.status !== "ready") {
      await withTimeout(redis.connect(), timeoutMs);
    }
    await withTimeout(redis.ping(), timeoutMs);
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: "up",
      latency: `${latencyMs}ms`,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: "down",
      latency: `${latencyMs}ms`,
      error: error.message || "Redis ping failed",
    };
  }
}


//  Memory metrics
export function getMemoryUsage() {
  const memory = process.memoryUsage();
  const formatMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

  return {
    rss: formatMB(memory.rss),
    heapTotal: formatMB(memory.heapTotal),
    heapUsed: formatMB(memory.heapUsed),
    external: formatMB(memory.external),
  };
}
