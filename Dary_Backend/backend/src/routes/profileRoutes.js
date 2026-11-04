import { Router } from "express";

import authMiddleware from "../core/middleware/authMiddleware.js";
import { requirePermission } from "../core/middleware/permissionMiddleware.js";
import validate from "../core/middleware/ValidateMiddleware.js";
import { validateUUID } from "../core/middleware/ValidateId.js";

import { uploadImage } from "../core/middleware/Upload/uploadMiddleware.js";

import {
  getMyProfile,
  upsertProfile,
  getPublicProfile,
  updateAvatar,
  deleteAvatar,
} from "../controllers/profileController.js";

import { upsertProfileSchema } from "../validation/profileValidation.js";

const router = Router();

router.get(
  "/me",
  authMiddleware,
  requirePermission("profile.read"),
  getMyProfile,
);

router.put(
  "/me",
  authMiddleware,
  requirePermission("profile.update"),
  validate(upsertProfileSchema),
  upsertProfile,
);

router.patch(
  "/avatar",
  authMiddleware,
  requirePermission("profile.avatar.update"),
  uploadImage.single("avatar"),
  updateAvatar,
);

router.delete(
  "/avatar",
  authMiddleware,
  requirePermission("profile.avatar.delete"),
  deleteAvatar,
);

router.get(
  "/:userId",
  validateUUID,
  getPublicProfile,
);

export default router;