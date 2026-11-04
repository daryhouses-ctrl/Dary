import { prisma } from "../config/prisma/PrismaService.js";
import { logger } from "../shared/logger/logger.js";

export async function cleanupRefreshTokens() {
  try {
    const now = new Date();

    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: now,
            },
          },
          {
            isRevoked: true,
          },
        ],
      },
    });

    logger.info(
      {
        deletedCount: result.count,
      },
      "Refresh token cleanup completed",
    );

    return result.count;
  } catch (error) {
    logger.error(
      {
        error: error.message || error,
      },
      "Refresh token cleanup failed",
    );

    throw error;
  }
}
