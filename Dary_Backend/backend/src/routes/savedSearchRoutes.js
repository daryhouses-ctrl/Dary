import { Router } from "express";

import authMiddleware from "../core/middleware/authMiddleware.js";
import { requirePermission } from "../core/middleware/permissionMiddleware.js";
import { validateUUID } from "../core/middleware/ValidateId.js";

import {
  createSavedSearch,
  getMySavedSearches,
  getSavedSearchById,
  updateSavedSearch,
  deleteSavedSearch,
} from "../controllers/savedSearchController.js";

const router = Router();

router.use(authMiddleware);

router.post(
  "/",
  requirePermission("saved_search.create"),
  createSavedSearch,
);

router.get(
  "/",
  requirePermission("saved_search.read_own"),
  getMySavedSearches,
);

router.get(
  "/:id",
  requirePermission("saved_search.read_own"),
  validateUUID,
  getSavedSearchById,
);

router.put(
  "/:id",
  requirePermission("saved_search.update"),
  validateUUID,
  updateSavedSearch,
);

router.delete(
  "/:id",
  requirePermission("saved_search.delete"),
  validateUUID,
  deleteSavedSearch,
);

export default router;