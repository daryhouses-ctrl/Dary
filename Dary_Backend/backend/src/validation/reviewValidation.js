import { z } from "zod";

const reviewStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED"], {
  errorMap: () => ({
    message: "status must be a valid review status",
  }),
});

const moderationStatusEnum = z.enum(["APPROVED", "REJECTED", "PENDING"], {
  errorMap: () => ({
    message: "status must be either APPROVED, REJECTED, or PENDING",
  }),
});
export const createReviewSchema = z.object({
  bookingId: z
    .string({ required_error: "bookingId is required" })
    .uuid("bookingId must be a valid uuid"),

  propertyRating: z
    .number({
      required_error: "propertyRating is required",
      invalid_type_error: "propertyRating must be a number",
    })
    .int("propertyRating must be an integer")
    .min(1, "propertyRating must be at least 1")
    .max(5, "propertyRating must be at most 5"),

  ownerRating: z
    .number({
      required_error: "ownerRating is required",
      invalid_type_error: "ownerRating must be a number",
    })
    .int("ownerRating must be an integer")
    .min(1, "ownerRating must be at least 1")
    .max(5, "ownerRating must be at most 5"),

  comment: z
    .string()
    .trim()
    .max(1000, "comment must be at most 1000 characters")
    .optional(),
});

export const moderateReviewSchema = z.object({
  status: moderationStatusEnum,
});

export const getAllReviewsQuerySchema = z
  .object({
    status: z.preprocess((val) => {
      if (!val || val === "ALL" || val === "all") return undefined;
      return val;
    }, reviewStatusEnum.optional()),

    propertyId: z.preprocess((val) => {
      if (!val) return undefined;
      return val;
    }, z.string().uuid("propertyId must be a valid uuid").optional()),

    ownerId: z.preprocess((val) => {
      if (!val) return undefined;
      return val;
    }, z.string().uuid("ownerId must be a valid uuid").optional()),

    page: z.preprocess((val) => {
      if (
        val === "" ||
        val === undefined ||
        val === null ||
        val === "undefined" ||
        val === "null"
      )
        return 1;
      const num = Number(val);
      if (isNaN(num) || num < 1) return 1;
      return Math.floor(num);
    }, z.number().int().positive().default(1)),

    limit: z.preprocess((val) => {
      if (
        val === "" ||
        val === undefined ||
        val === null ||
        val === "undefined" ||
        val === "null"
      )
        return 20;
      const num = Number(val);
      if (isNaN(num) || num < 1) return 20;
      return Math.min(Math.floor(num), 100);
    }, z.number().int().positive().max(100).default(20)),
  })
  .passthrough();

export const paginationQuerySchema = z
  .object({
    page: z.preprocess((val) => {
      if (
        val === "" ||
        val === undefined ||
        val === null ||
        val === "undefined" ||
        val === "null"
      )
        return 1;
      const num = Number(val);
      if (isNaN(num) || num < 1) return 1;
      return Math.floor(num);
    }, z.number().int().positive().default(1)),

    limit: z.preprocess((val) => {
      if (
        val === "" ||
        val === undefined ||
        val === null ||
        val === "undefined" ||
        val === "null"
      )
        return 20;
      const num = Number(val);
      if (isNaN(num) || num < 1) return 20;
      return Math.min(Math.floor(num), 100);
    }, z.number().int().positive().max(100).default(20)),
  })
  .passthrough();
