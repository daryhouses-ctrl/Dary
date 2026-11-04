import pino from "pino";

const useJsonLogs = process.env.LOG_FORMAT === "json";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",

  base: {
    service: process.env.SERVICE_NAME || "dary-api",
    environment: process.env.NODE_ENV || "development",
  },

  timestamp: pino.stdTimeFunctions.isoTime,

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers.set-cookie",
      "res.headers.set-cookie",
    ],
    censor: "[REDACTED]",
  },

  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
      singleLine: false,
    },
  },
});

export default logger;