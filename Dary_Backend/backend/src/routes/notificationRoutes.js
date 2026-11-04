import { Router } from "express";

import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
} from "../controllers/notificationController.js";

import authMiddleware from "../core/middleware/authMiddleware.js";
import { requirePermission } from "../core/middleware/permissionMiddleware.js";
import { validateUUID } from "../core/middleware/ValidateId.js";

const router = Router();

router.get(
  "/",
  authMiddleware,
  requirePermission("notification.read"),
  getMyNotifications,
);

router.patch(
  "/read-all",
  authMiddleware,
  requirePermission("notification.read"),
  markAllAsRead,
);

router.patch(
  "/:id/read",
  authMiddleware,
  requirePermission("notification.read"),
  validateUUID,
  markAsRead,
);

router.delete(
  "/read",
  authMiddleware,
  requirePermission("notification.delete"),
  deleteAllRead,
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission("notification.delete"),
  validateUUID,
  deleteNotification,
);

export default router;