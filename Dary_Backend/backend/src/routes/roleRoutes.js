import { Router } from "express";

import authMiddleware from "../core/middleware/authMiddleware.js";
import { requirePermission } from "../core/middleware/permissionMiddleware.js";

import {
  findAllRoles,
  assignRole,
  removeRole,
  getUserRoles,
  createRole,
} from "../controllers/roleController.js";

import validate from "../core/middleware/ValidateMiddleware.js";
import { validateUUID } from "../core/middleware/ValidateId.js";

import {
  assignRoleSchema,
  removeRoleSchema,
  createRoleSchema,
} from "../validation/roleValidation.js";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("role.create"),
  validate(createRoleSchema, "body"),
  createRole,
);

router.get("/", authMiddleware, requirePermission("role.read"), findAllRoles);

router.post(
  "/assign",
  authMiddleware,
  requirePermission("role.assign"),
  validate(assignRoleSchema, "body"),
  assignRole,
);

router.post(
  "/remove",
  authMiddleware,
  requirePermission("role.remove"),
  validate(removeRoleSchema, "body"),
  removeRole,
);

router.get(
  "/user/:userId",
  authMiddleware,
  requirePermission("role.read"),
  validateUUID,
  getUserRoles,
);

export default router;
