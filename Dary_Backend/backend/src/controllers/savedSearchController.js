import asyncHandler from "express-async-handler";

import {
  createSavedSearchService,
  getMySavedSearchesService,
  getSavedSearchByIdService,
  updateSavedSearchService,
  deleteSavedSearchService,
} from "../services/savedSearchServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

// @desc   Create saved search
// @route  POST /api/saved-searches
// @access Private
export const createSavedSearch = asyncHandler(async (req, res) => {
  const savedSearch = await createSavedSearchService(
    req.user.id,
    req.body,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("savedSearch.created"),
    data: { savedSearch },
  });
});

// @desc   Get my saved searches
// @route  GET /api/saved-searches
// @access Private
export const getMySavedSearches = asyncHandler(async (req, res) => {
  const savedSearches = await getMySavedSearchesService(req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("savedSearch.listRetrieved"),
    data: { savedSearches, count: savedSearches.length },
  });
});

// @desc   Get saved search by ID
// @route  GET /api/saved-searches/:id
// @access Private
export const getSavedSearchById = asyncHandler(async (req, res) => {
  const savedSearch = await getSavedSearchByIdService(
    req.user.id,
    req.params.id,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("savedSearch.retrieved"),
    data: { savedSearch },
  });
});

// @desc   Update saved search
// @route  PUT /api/saved-searches/:id
// @access Private
export const updateSavedSearch = asyncHandler(async (req, res) => {
  const savedSearch = await updateSavedSearchService(
    req.user.id,
    req.params.id,
    req.body,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("savedSearch.updated"),
    data: { savedSearch },
  });
});

// @desc   Delete saved search
// @route  DELETE /api/saved-searches/:id
// @access Private
export const deleteSavedSearch = asyncHandler(async (req, res) => {
  await deleteSavedSearchService(req.user.id, req.params.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("savedSearch.deleted"),
    data: null,
  });
});