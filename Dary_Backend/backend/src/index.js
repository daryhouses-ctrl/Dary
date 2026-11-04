import express from "express";
import * as Sentry from "@sentry/node";
import cookieParser from "cookie-parser";
import i18next, { i18nextMiddleware } from "./core/i18n/i18n.js";
import hpp from "hpp";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import {
  notFound,
  errorHandler,
} from "./core/middleware/error/ErrorHandler.js";
import { AppError } from "./core/middleware/error/AppError.js";
import { httpLogger } from "./shared/logger/httpLogger.js";
import multerErrorHandler from "./core/middleware/error/MulterErrorHandler.js";
import { metricsMiddleware } from "./observability/metricsMiddleware.js";
import { register } from "./observability/metrics.js";

import pinoHttp from "pino-http";
import logger from "./observability/logger.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Dary Backend API is running",
  });
});

// app.use(
//   helmet({
//     contentSecurityPolicy: {
//       directives: {
//         defaultSrc: ["'self'"],
//         scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
//         styleSrc: ["'self'", "https://fonts.googleapis.com"],
//         fontSrc: ["'self'", "https://fonts.gstatic.com"],
//         connectSrc: [
//           "'self'",
//           "ws:",
//           "wss:",
//           "ws://localhost:8003",
//           "wss://localhost:8003",
//         ],
//         imgSrc: ["'self'", "data:"],
//       },
//     },
//   }),
// );
// app.use(hpp());

app.use(metricsMiddleware);
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);

  res.end(await register.metrics());
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/+$/, "");
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://localhost:5500",
        process.env.FRONTEND_URL,
        process.env.CLIENT_URL,
        "https://dary-frontend-ykrl.vercel.app",
        "https://dary-19o9.vercel.app",
        "https://dary-19o9-l4rq4871m-dary6.vercel.app",
        "https://dary-19o9-1cn0joyl2-dary6.vercel.app"
        
      ].filter(Boolean);

      if (
        allowedOrigins.includes(normalizedOrigin) ||
        normalizedOrigin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  }),
);
app.use(cookieParser());
// app.use(
//   statusMonitor({ websocket: null, spans: [{ interval: 1, retention: 60 }] }),
// );
// app.use(
//   rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 100,
//     message: "Too many requests from this IP, please try again later.",
//   }),
// );

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

// app.use(httpLogger);

import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import propertiesRoutes from "./routes/propertyRoutes.js";
import rolesRoutes from "./routes/roleRoutes.js";
import permissionRoutes from "./routes/permissionRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import supportTicketRoutes from "./routes/supportTicketRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import favoriteRoutes from "./routes/favoriteRoutes.js";
import savedSearchRoutes from "./routes/savedSearchRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";

app.use(i18nextMiddleware);

app.use(
  pinoHttp({
    logger,

    customLogLevel(req, res, err) {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },

    customSuccessMessage(req, res) {
      return `${req.method} ${req.originalUrl} completed`;
    },

    customErrorMessage(req, res) {
      return `${req.method} ${req.originalUrl} failed`;
    },

    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.originalUrl,
          remoteAddress: req.ip,
        };
      },

      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use("/", healthRoutes);
app.use("/api/v1", healthRoutes);
// _______________________________________________________

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/properties", propertiesRoutes);
app.use("/api/v1/roles", rolesRoutes);
app.use("/api/v1/permissions", permissionRoutes);
app.use("/api/v1/booking", bookingRoutes);
app.use("/api/v1/contract", contractRoutes);
app.use("/api/v1/review", reviewRoutes);
app.use("/api/v1/report", reportRoutes);
app.use("/api/v1/support-ticket", supportTicketRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/favorites", favoriteRoutes);
app.use("/api/v1/saved-searches", savedSearchRoutes);
app.use("/api/v1/notifications", notificationRoutes);

// _____________________________________________________

if (process.env.NODE_ENV !== "production") {
  app.get("/debug-sentry", (req, res) => {
    throw new Error("Dary Sentry Test Error");
  });
}

Sentry.setupExpressErrorHandler(app);
app.use(multerErrorHandler);
app.use(notFound);
app.use(errorHandler);

export default app;
