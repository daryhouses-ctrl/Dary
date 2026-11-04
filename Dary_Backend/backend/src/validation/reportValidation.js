import { z } from "zod";

const reportedTypeEnum = z.enum(["property", "user", "spam", "fraud"], {
  errorMap: () => ({
    message: "reportedType must be a valid report type",
  }),
});

const reportPriorityEnum = z
  .enum(
    ["low", "medium", "high", "urgent", "LOW", "MEDIUM", "HIGH", "URGENT"],
    {
      errorMap: () => ({
        message: "priority must be one of low, medium, high, urgent",
      }),
    },
  )
  .transform((val) =>
    val.toLowerCase() === "urgent" ? "high" : val.toLowerCase(),
  );

const reportStatusEnum = z
  .enum(["PENDING", "RESOLVED", "pending", "resolved"], {
    errorMap: () => ({
      message: "status must be a valid report status",
    }),
  })
  .transform((val) => val.toUpperCase());

export const createReportSchema = z
  .object({
    reportedType: reportedTypeEnum,

    reportedPropertyId: z
      .string()
      .uuid("reportedPropertyId must be a valid uuid")
      .optional(),

    reportedUserId: z
      .string()
      .uuid("reportedUserId must be a valid uuid")
      .optional(),

    description: z
      .string()
      .trim()
      .max(2000, "description must be at most 2000 characters")
      .optional(),

    priority: reportPriorityEnum.optional(),
  })
  .refine(
    (data) =>
      data.reportedType === "property"
        ? !!data.reportedPropertyId && !data.reportedUserId
        : !!data.reportedUserId && !data.reportedPropertyId,
    {
      message:
        "property reports require reportedPropertyId; other reports require reportedUserId",
      path: ["reportedType"],
    },
  );

export const updateReportPrioritySchema = z.object({
  priority: reportPriorityEnum,
});

export const resolveReportSchema = z.object({
  resolutionNotes: z
    .string()
    .trim()
    .max(1000, "resolutionNotes must be at most 1000 characters")
    .optional()
    .transform((val) =>
      val && val.trim().length > 0 ? val.trim() : "تمت المراجعة والتسوية بنجاح",
    ),
});

export const getAllReportsQuerySchema = z.object({
  status: reportStatusEnum.optional(),

  reportedType: reportedTypeEnum.optional(),

  priority: reportPriorityEnum.optional(),

  page: z.coerce
    .number({ invalid_type_error: "page must be a number" })
    .int("page must be an integer")
    .positive("page must be greater than 0")
    .optional(),

  limit: z.coerce
    .number({ invalid_type_error: "limit must be a number" })
    .int("limit must be an integer")
    .positive("limit must be greater than 0")
    .max(100, "limit must be at most 100")
    .optional(),
});
