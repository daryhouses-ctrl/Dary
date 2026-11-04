import { Router } from "express";

import authMiddleware from "../core/middleware/authMiddleware.js";
import { requirePermission } from "../core/middleware/permissionMiddleware.js";
import { validateUUID } from "../core/middleware/ValidateId.js";

import {
  addFavorite,
  getMyFavorites,
  removeFavorite,
} from "../controllers/favoritesController.js";

const router = Router();

router.post(
  "/:propertyId",
  authMiddleware,
  requirePermission("favorite.create"),
  validateUUID,
  addFavorite,
);

router.get(
  "/",
  authMiddleware,
  requirePermission("favorite.read_own"),
  getMyFavorites,
);

router.delete(
  "/:propertyId",
  authMiddleware,
  requirePermission("favorite.delete"),
  validateUUID,
  removeFavorite,
);

export default router;
