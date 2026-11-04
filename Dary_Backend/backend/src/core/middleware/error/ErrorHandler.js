import * as Sentry from "@sentry/node";
import { AppError } from "./AppError.js";

//  Not Found Middleware
export const notFound = (req, res, next) => {
  const error = new AppError(`Not Found - ${req.originalUrl}`, 404);
  next(error);
};

//  Global Error Handler
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  // إرسال أخطاء الخادم (5xx) فقط إلى Sentry لمتابعتها أونلاين دون إزعاج بأخطاء العميل المعتادة (4xx)
  if (statusCode >= 500) {
    Sentry.captureException(err);
  }

  const message =
    isProduction && !err.isOperational ? "Something went wrong" : err.message;

  res.status(statusCode).json({
    success: false,
    status: err.status || "error",
    message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};