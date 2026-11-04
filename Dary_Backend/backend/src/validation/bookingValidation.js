import { z } from "zod";

const bookingStatusEnum = z.enum(
  ["PENDING", "CONTACTED", "CONFIRMED", "CLOSED", "CANCELLED"],
  {
    errorMap: () => ({
      message: "status must be a valid booking status",
    }),
  },
);

const updatableBookingStatusEnum = z.enum(
  ["PENDING", "CONTACTED", "CONFIRMED", "CLOSED", "CANCELLED"],
  {
    errorMap: () => ({
      message:
        "status must be one of PENDING, CONTACTED, CONFIRMED, CLOSED, CANCELLED",
    }),
  },
);

export const createBookingSchema = z
  .object({
    propertyId: z
      .string({ required_error: "propertyId is required" })
      .uuid("propertyId must be a valid uuid"),

    roomId: z
      .string({ required_error: "roomId is required" })
      .uuid("roomId must be a valid uuid"),

    bedsRequested: z
      .number({ invalid_type_error: "bedsRequested must be a number" })
      .int("bedsRequested must be an integer")
      .positive("bedsRequested must be greater than 0")
      .optional(),

    startDate: z.coerce.date({
      required_error: "startDate is required",
      invalid_type_error: "startDate must be a valid date",
    }),

    endDate: z.coerce.date({
      required_error: "endDate is required",
      invalid_type_error: "endDate must be a valid date",
    }),

    note: z
      .string()
      .trim()
      .max(500, "note must be at most 500 characters")
      .optional(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export const updateBookingStatusSchema = z
  .object({
    status: updatableBookingStatusEnum,

    note: z
      .string()
      .trim()
      .max(500, "note must be at most 500 characters")
      .optional(),
  })
  .refine((data) => data.status !== "CANCELLED" || Boolean(data.note?.trim()), {
    message: "note is required when status is CANCELLED",
    path: ["note"],
  });

export const getAllBookingsQuerySchema = z.object({
  status: z.string().optional(),

  propertyId: z.string().optional(),

  roomId: z.string().optional(),

  assignedAdminId: z.string().optional(),

  tenantId: z.string().optional(),

  search: z.string().trim().optional(),

  cursor: z.string().optional(),

  startDate: z.string().optional(),

  endDate: z.string().optional(),

  sort: z.string().optional(),

  order: z.enum(["asc", "desc", "ASC", "DESC"]).optional(),

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
