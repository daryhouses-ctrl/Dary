import * as Sentry from "@sentry/node";

const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const dataToValidate = req[source] ?? {};
    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;

      // إرسال تقرير تحذيري إلى Sentry لمتابعة أخطاء التحقق في البرودكشن أونلاين
      try {
        const sanitizedData = { ...dataToValidate };
        if (sanitizedData.password) sanitizedData.password = "[REDACTED]";
        if (sanitizedData.confirmPassword) sanitizedData.confirmPassword = "[REDACTED]";

        Sentry.withScope((scope) => {
          scope.setLevel("error");
          scope.setTag("error_type", "validation_error");
          scope.setContext("validation_details", {
            url: req.originalUrl,
            method: req.method,
            errors: fieldErrors,
            receivedData: sanitizedData,
          });
          Sentry.captureMessage(
            `Validation Error: ${req.method} ${req.originalUrl} - [${Object.keys(fieldErrors).join(", ")}]`,
            "error",
          );
        });
      } catch (sentryError) {
        // لا نسمح لأي خطأ في تسجيل Sentry بتعطيل استجابة السيرفر
      }

      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: fieldErrors,
      });
    }

    if (source === "query") {
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    } else {
      try {
        req[source] = result.data;
      } catch {
        Object.defineProperty(req, source, {
          value: result.data,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }

    next();
  };
};

export default validate;