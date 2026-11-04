import { Router } from "express";

import {
  createReview,
  getPropertyReviews,
  getOwnerReviews,
  getMyReviews,
  getPendingReviews,
  moderateReview,
  getAllReviews,
} from "../controllers/reviewController.js";

import authMiddleware from "../core/middleware/authMiddleware.js";
import { requirePermission } from "../core/middleware/permissionMiddleware.js";
import validate from "../core/middleware/ValidateMiddleware.js";
import { validateUUID } from "../core/middleware/ValidateId.js";

import {
  createReviewSchema,
  moderateReviewSchema,
  getAllReviewsQuerySchema,
  paginationQuerySchema,
} from "../validation/reviewValidation.js";

const router = Router();

router.get(
  "/property/:propertyId",
  validateUUID,
  // validate(paginationQuerySchema, "query"),
  getPropertyReviews,
);

router.get(
  "/owner/:ownerId",
  validateUUID,
  // validate(paginationQuerySchema, "query"),
  getOwnerReviews,
);

router.post(
  "/",
  authMiddleware,
  requirePermission("review.create"),
  validate(createReviewSchema, "body"),
  createReview,
);

router.get(
  "/my",
  authMiddleware,
  requirePermission("review.read_own"),
  validate(paginationQuerySchema, "query"),
  getMyReviews,
);

router.get(
  "/pending",
  authMiddleware,
  requirePermission("review.read_pending"),
  validate(paginationQuerySchema, "query"),
  getPendingReviews,
);

router.get(
  "/",
  authMiddleware,
  requirePermission("review.read"),
  validate(getAllReviewsQuerySchema, "query"),
  getAllReviews,
);

router.patch(
  "/:id/moderate",
  authMiddleware,
  requirePermission("review.moderate"),
  validateUUID,
  validate(moderateReviewSchema, "body"),
  moderateReview,
);

export default router;