import { z } from "zod";

const roleNameEnum = z.enum(["tenant", "owner", "admin", "super_admin"], {
  errorMap: () => ({
    message: "roleName must be one of tenant, owner, admin, super_admin",
  }),
});

export const createRoleSchema = z.object({
  name: z
    .string({ required_error: "name is required" })
    .trim()
    .toLowerCase()
    .min(2, "name must be at least 2 characters")
    .max(50, "name must be at most 50 characters"),

  description: z
    .string()
    .trim()
    .max(255, "description must be at most 255 characters")
    .optional(),
});

export const assignRoleSchema = z.object({
  userId: z
    .string({ required_error: "userId is required" })
    .uuid("userId must be a valid uuid"),

  roleName: roleNameEnum,
});

export const removeRoleSchema = z.object({
  userId: z
    .string({ required_error: "userId is required" })
    .uuid("userId must be a valid uuid"),

  roleName: roleNameEnum,
});
