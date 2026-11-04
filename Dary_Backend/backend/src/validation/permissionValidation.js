import { z } from "zod";

const permissionNameRegex = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

export const createPermissionSchema = z.object({
  name: z
    .string({ required_error: "name is required" })
    .trim()
    .toLowerCase()
    .min(3, "name must be at least 3 characters")
    .max(100, "name must be at most 100 characters")
    .regex(
      permissionNameRegex,
      "name must be lowercase and dot-separated (e.g. booking.create)",
    ),

  description: z
    .string()
    .trim()
    .max(255, "description must be at most 255 characters")
    .optional(),
});

export const updatePermissionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "name must be at least 3 characters")
      .max(100, "name must be at most 100 characters")
      .regex(
        permissionNameRegex,
        "name must be lowercase and dot-separated (e.g. booking.create)",
      )
      .optional(),

    description: z
      .string()
      .trim()
      .max(255, "description must be at most 255 characters")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "at least one field must be provided to update",
  });

export const assignPermissionsToRoleSchema = z.object({
  roleId: z.string({ required_error: "roleId is required" }).uuid(),

  permissionIds: z
    .array(z.string().uuid("each permissionId must be a valid uuid"))
    .min(1, "permissionIds cannot be empty"),
});
