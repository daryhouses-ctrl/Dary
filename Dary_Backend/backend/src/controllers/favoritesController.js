import asyncHandler from "express-async-handler";
import {
  addFavoriteService,
  getMyFavoritesService,
  removeFavoriteService,
} from "../services/favoritesServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

// @desc Add property to favorites
// @route POST /api/favorites/:propertyId
// @access Private
export const addFavorite = asyncHandler(async (req, res) => {
  const { propertyId } = req.params;
  const userId = req.user.id;

  const favorite = await addFavoriteService(userId, propertyId);

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("favorite.added"),
    data: { favorite },
  });
});

// @desc Get my favorite properties
// @route GET /api/favorites
// @access Private
export const getMyFavorites = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const favorites = await getMyFavoritesService(userId);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("favorite.fetched"),
    data: { favorites, count: favorites.length },
  });
});

// @desc Remove property from favorites
// @route DELETE /api/favorites/:propertyId
// @access Private
export const removeFavorite = asyncHandler(async (req, res) => {
  const { propertyId } = req.params;
  const userId = req.user.id;

  const result = await removeFavoriteService(userId, propertyId);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("favorite.removed"),
    data: result,
  });
});