import "./instrument.js";
import "dotenv/config";
import http from "http";
import app from "./index.js";
import { connectDB } from "./config/prisma/PrismaService.js";
import { startRefreshTokenCleanupJob } from "./core/jobs/refreshTokenCleanup.job.js";
import { startPoolMonitorJob } from "./core/jobs/poolMonitor.job.js";
const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);

async function bootstrap() {
  try {
    await connectDB();
    startRefreshTokenCleanupJob();
    startPoolMonitorJob();
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server bootstrap failed:", error);

    process.exit(1);
  }
}
bootstrap();
