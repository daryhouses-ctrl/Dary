import asyncHandler from "express-async-handler";
import {
  uploadPropertyImagesService,
  getPropertyImagesService,
  deletePropertyImageService,
  setPrimaryImageService,
  reorderPropertyImagesService,
} from "../services/propertyImageServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

const checkIsAdmin = (req) =>
  Array.isArray(req.user?.roles) &&
  req.user.roles.some((r) => ["admin", "super_admin"].includes(r));

// @desc   Upload images for a property
// @route  POST /properties/:propertyId/images
// @access Private (owner / admin)
export const uploadPropertyImages = asyncHandler(async (req, res) => {
  const images = await uploadPropertyImagesService(
    req.params.propertyId,
    req.user.id,
    req.files,
    req.body.category,
    req.t,
    checkIsAdmin(req),
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("property.imagesUploaded"),
    data: { images },
  });
});

// @desc   Get all images of a property
// @route  GET /properties/:propertyId/images
// @access Public
export const getPropertyImages = asyncHandler(async (req, res) => {
  const images = await getPropertyImagesService(req.params.propertyId, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.imagesRetrieved"),
    data: { images },
  });
});

// @desc   Delete an image
// @route  DELETE /properties/images/:imageId
// @access Private (owner / admin)
export const deletePropertyImage = asyncHandler(async (req, res) => {
  await deletePropertyImageService(
    req.params.imageId,
    req.user.id,
    req.t,
    checkIsAdmin(req),
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.imageDeleted"),
    data: null,
  });
});

// @desc   Set an image as primary
// @route  PATCH /properties/images/:imageId/primary
// @access Private (owner / admin)
export const setPrimaryImage = asyncHandler(async (req, res) => {
  const image = await setPrimaryImageService(
    req.params.imageId,
    req.user.id,
    req.t,
    checkIsAdmin(req),
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.primarySet"),
    data: { image },
  });
});

// @desc   Reorder images
// @route  PATCH /properties/:propertyId/images/reorder
// @access Private (owner / admin)
export const reorderPropertyImages = asyncHandler(async (req, res) => {
  const images = await reorderPropertyImagesService(
    req.params.propertyId,
    req.user.id,
    req.body.order,
    req.t,
    checkIsAdmin(req),
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.imagesReordered"),
    data: { images },
  });
});