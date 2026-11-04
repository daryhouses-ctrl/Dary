import pino from "pino";

const useJsonLogs = process.env.LOG_FORMAT === "json";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",

  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",

      "req.body.password",
      "req.body.passwordHash",
      "req.body.token",
      "req.body.accessToken",
      "req.body.refreshToken",
      "req.body.otp",

      "password",
      "passwordHash",
      "token",
      "accessToken",
      "refreshToken",
      "otp",
    ],
    censor: "[REDACTED]",
  },
});