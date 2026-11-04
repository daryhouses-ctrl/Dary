import { Router } from "express";

import authMiddleware from "../core/middleware/authMiddleware.js";
import { requirePermission } from "../core/middleware/permissionMiddleware.js";
import validate from "../core/middleware/ValidateMiddleware.js";
import { validateUUID } from "../core/middleware/ValidateId.js";

import {
  findAllPermissions,
  createPermission,
  updatePermission,
  removePermission,
  assignPermissionsToRole,
  getRolePermissions,
  removePermissionFromRole,
} from "../controllers/permissionController.js";

import {
  createPermissionSchema,
  updatePermissionSchema,
  assignPermissionsToRoleSchema,
} from "../validation/permissionValidation.js";

const router = Router();

router.get(
  "/",
  authMiddleware,
  requirePermission("permission.read"),
  findAllPermissions,
);

router.post(
  "/",
  authMiddleware,
  requirePermission("permission.create"),
  validate(createPermissionSchema, "body"),
  createPermission,
);

router.patch(
  "/:id",
  authMiddleware,
  requirePermission("permission.update"),
  validate(updatePermissionSchema, "body"),
  validateUUID,
  updatePermission,
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission("permission.delete"),
  validateUUID,
  removePermission,
);

router.post(
  "/assign-to-role",
  authMiddleware,
  requirePermission("permission.assign"),
  validate(assignPermissionsToRoleSchema, "body"),
  assignPermissionsToRole,
);

router.get(
  "/role/:roleId",
  authMiddleware,
  requirePermission("permission.read"),
  validateUUID,
  getRolePermissions,
);

router.delete(
  "/role/:roleId/:permissionId",
  authMiddleware,
  requirePermission("permission.remove"),
  validateUUID,
  removePermissionFromRole,
);

export default router;