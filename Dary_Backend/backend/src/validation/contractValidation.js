import { z } from "zod";

const contractStatusEnum = z.enum(
  ["DRAFT", "SENT", "SIGNED", "ACTIVE", "CANCELLED"],
  {
    errorMap: () => ({
      message: "status must be a valid contract status",
    }),
  },
);

export const createContractSchema = z.object({
  bookingId: z
    .string({ required_error: "bookingId is required" })
    .uuid("bookingId must be a valid uuid"),
});

export const getAllContractsQuerySchema = z.object({
  status: contractStatusEnum.optional(),

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

export function validatePdfFilePresence(req, res, next, t) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: t("contract.pdfRequired"),
    });
  }

  next();
}
