import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const globalForPrisma = globalThis;

if (!globalForPrisma.pgPool) {
  globalForPrisma.pgPool = new pg.Pool({
    connectionString: databaseUrl,
    max: process.env.PG_POOL_MAX ? parseInt(process.env.PG_POOL_MAX, 10) : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: new PrismaPg(globalForPrisma.pgPool),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function getDatabasePoolStats() {
  const pool = globalForPrisma.pgPool;

  if (!pool) {
    return {
      total: 0,
      idle: 0,
      waiting: 0,
      max: 0,
    };
  }

  return {
    total: pool.totalCount ?? 0,
    idle: pool.idleCount ?? 0,
    waiting: pool.waitingCount ?? 0,
    max: pool.options?.max ?? 0,
  };
}

async function connectDB() {
  try {
    await prisma.$connect();

    console.log("Connected to PostgreSQL");

    await prisma
      .$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
         CREATE INDEX IF NOT EXISTS "refresh_tokens_is_revoked_created_at_idx" ON "refresh_tokens"("is_revoked", "created_at");
         CREATE INDEX IF NOT EXISTS "users_email_active_idx" ON "users"("email") WHERE "deleted_at" IS NULL;
         CREATE INDEX IF NOT EXISTS "user_roles_user_id_idx" ON "user_roles"("user_id");
         CREATE INDEX IF NOT EXISTS "reports_priority_created_at_idx" ON "reports"("priority" DESC, "created_at" DESC);
         CREATE INDEX IF NOT EXISTS "reports_reporter_id_created_at_idx" ON "reports"("reporter_id", "created_at" DESC);`,
      )
      .catch((e) =>
        console.warn("Notice: performance indexes check:", e.message),
      );
  } catch (error) {
    console.error("Failed to connect to PostgreSQL");
    console.error(error);

    throw error;
  }
}

async function disconnectDB() {
  try {
    await prisma.$disconnect();
    if (globalForPrisma.pgPool) {
      await globalForPrisma.pgPool.end();
      globalForPrisma.pgPool = null;
    }
  } catch (err) {
    console.error("Error disconnecting DB:", err);
  }
  console.log("Database disconnected");
}

if (process.env.NODE_ENV !== "production") {
  process.on("SIGINT", async () => {
    await disconnectDB();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await disconnectDB();
    process.exit(0);
  });
}

export {
  prisma,
  connectDB,
  disconnectDB,
  getDatabasePoolStats,
};





// http://localhost:8003/api/v1/health/db