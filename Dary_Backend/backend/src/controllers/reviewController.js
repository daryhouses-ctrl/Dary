import asyncHandler from "express-async-handler";
import {
  createReviewService,
  getPropertyReviewsService,
  getOwnerReviewsService,
  getMyReviewsService,
  getPendingReviewsService,
  moderateReviewService,
  getAllReviewsService,
} from "../services/reviewServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

// @desc   Create review (Tenant) - after booking is CLOSED
// @route  POST /reviews
// @access Private (tenant)
export const createReview = asyncHandler(async (req, res) => {
  const review = await createReviewService(req.user.id, req.body, req.t);

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("review.created"),
    data: { review },
  });
});

// @desc   Get approved reviews for a property (Public)
// @route  GET /reviews/property/:propertyId
// @access Public
export const getPropertyReviews = asyncHandler(async (req, res) => {
  const result = await getPropertyReviewsService(
    req.params.propertyId,
    req.query,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t ? req.t("review.propertyListRetrieved") : "Reviews retrieved successfully",
    data: result,
  });
});

// @desc   Get approved reviews for an owner (Public)
// @route  GET /reviews/owner/:ownerId
// @access Public
export const getOwnerReviews = asyncHandler(async (req, res) => {
  const result = await getOwnerReviewsService(
    req.params.ownerId,
    req.query,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("review.ownerListRetrieved"),
    data: result,
  });
});

// @desc   Get my reviews (Tenant)
// @route  GET /reviews/my
// @access Private (tenant)
export const getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await getMyReviewsService(req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("review.myListRetrieved"),
    data: { reviews },
  });
});

// @desc   Get pending reviews (Admin)
// @route  GET /reviews/pending
// @access Private (admin)
export const getPendingReviews = asyncHandler(async (req, res) => {
  const reviews = await getPendingReviewsService(req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("review.pendingRetrieved"),
    data: { reviews },
  });
});

// @desc   Moderate review - approve/reject (Admin)
// @route  PATCH /reviews/:id/moderate
// @access Private (admin)
export const moderateReview = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const review = await moderateReviewService(
    req.params.id,
    req.user.id,
    status,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("review.moderated"),
    data: { review },
  });
});

// @desc   Get all reviews (Admin)
// @route  GET /reviews
// @access Private (admin)
export const getAllReviews = asyncHandler(async (req, res) => {
  const result = await getAllReviewsService(req.query, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("review.listRetrieved"),
    data: result,
  });
});