// jobs/refreshTokenCleanup.job.js

import cron from "node-cron";
import { cleanupRefreshTokens } from "../../services/refreshTokenCleanupService.js";

export function startRefreshTokenCleanupJob() {
  // Run once on startup to immediately clean up any accumulated expired or revoked tokens
  cleanupRefreshTokens().catch((error) => {
    console.error("Initial refresh token cleanup failed:", error);
  });

  cron.schedule("0 3 * * *", async () => {
    try {
      await cleanupRefreshTokens();
    } catch (error) {
      console.error("Refresh token cleanup job failed:", error);
    }
  });

  console.log("Refresh token cleanup job scheduled.");
}