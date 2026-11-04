import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { logger } from "./logger.js";

export const httpLogger = pinoHttp({
  logger,

  genReqId: (req) => {
    return req.headers["x-request-id"] || randomUUID();
  },

  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      remoteAddress: req.remoteAddress,
    }),

    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },

  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) {
      return "error";
    }

    if (res.statusCode >= 400) {
      return "warn";
    }

    return "info";
  },

  customSuccessMessage: (req, res, responseTime) => {
    const duration = Math.round(responseTime || 0);
    return `${req.method} ${req.originalUrl || req.url} status=${res.statusCode} duration=${duration}ms`;
  },

  customErrorMessage: (req, res, err, responseTime) => {
    const duration = Math.round(responseTime || 0);
    return `${req.method} ${req.originalUrl || req.url} status=${res.statusCode} duration=${duration}ms failed`;
  },
});
