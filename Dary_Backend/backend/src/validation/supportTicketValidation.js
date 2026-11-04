import { z } from "zod";

const ticketStatusEnum = z.enum(
  ["OPEN", "INVESTIGATING", "RESOLVED", "ARCHIVED"],
  {
    errorMap: () => ({
      message: "status must be a valid ticket status",
    }),
  },
);

const updatableTicketStatusEnum = z.enum(
  ["INVESTIGATING", "RESOLVED", "ARCHIVED"],
  {
    errorMap: () => ({
      message: "status must be one of INVESTIGATING, RESOLVED, ARCHIVED",
    }),
  },
);

export const createTicketSchema = z.object({
  category: z
    .string({
      required_error: "category is required",
    })
    .trim()
    .min(2, "category must be at least 2 characters")
    .max(50, "category must be at most 50 characters"),

  subject: z
    .string({
      required_error: "subject is required",
    })
    .trim()
    .min(3, "subject must be at least 3 characters")
    .max(150, "subject must be at most 150 characters"),

  description: z
    .string({
      required_error: "description is required",
    })
    .trim()
    .min(5, "description must be at least 5 characters")
    .max(3000, "description must be at most 3000 characters"),
});

export const addTicketMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .max(3000, "message must be at most 3000 characters")
    .optional(),
});

export const updateTicketStatusSchema = z.object({
  status: updatableTicketStatusEnum,
});

export const getAllTicketsQuerySchema = z.object({
  status: ticketStatusEnum.optional(),

  category: z.string().trim().optional(),

  search: z.string().trim().optional(),

  sort: z
    .enum(["createdAt", "updatedAt", "status", "category"])
    .optional(),

  order: z
    .enum(["asc", "desc", "ASC", "DESC"])
    .optional(),

  cursor: z.string().trim().optional(),

  page: z.coerce
    .number({
      invalid_type_error: "page must be a number",
    })
    .int("page must be an integer")
    .positive("page must be greater than 0")
    .optional(),

  limit: z.coerce
    .number({
      invalid_type_error: "limit must be a number",
    })
    .int("limit must be an integer")
    .positive("limit must be greater than 0")
    .max(100, "limit must be at most 100")
    .optional(),
});
