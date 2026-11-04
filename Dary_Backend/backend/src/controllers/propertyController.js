import asyncHandler from "express-async-handler";
import {
  createPropertyService,
  getPropertiesService,
  getPropertyFacetsService,
  getPropertyByIdService,
  getMyPropertiesService,
  updatePropertyService,
  deletePropertyService,
  toggleAvailabilityService,
  getPendingPropertiesService,
  reviewPropertyService,
  suspendPropertyService,
} from "../services/propertyServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

// @desc   Create property
// @route  POST /properties
// @access Private (owner)
export const createProperty = asyncHandler(async (req, res) => {
  const property = await createPropertyService(
    req.user.id,
    req.body,
    req.files,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("property.created"),
    data: { property },
  });
});

// @desc   Get dynamic property filter facets
// @route  GET /properties/facets
// @access Public
export const getPropertyFacets = asyncHandler(async (req, res) => {
  const facets = await getPropertyFacetsService();

  return sendSuccess(res, {
    statusCode: 200,
    message: "Filter facets retrieved successfully",
    data: { facets },
  });
});

// @desc   Get public properties list
// @route  GET /properties
// @access Public
export const getProperties = asyncHandler(async (req, res) => {
  const result = await getPropertiesService(req.query, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.listRetrieved"),
    data: result,
  });
});

// @desc   Get single property
// @route  GET /properties/:id
// @access Public
export const getPropertyById = asyncHandler(async (req, res) => {
  const viewer = req.user
    ? {
        id: req.user.id,
        isAdmin:
          Array.isArray(req.user.roles) &&
          req.user.roles.some((r) => ["admin", "super_admin"].includes(r)),
      }
    : null;

  const property = await getPropertyByIdService(
    req.params.id,
    viewer,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.retrieved"),
    data: { property },
  });
});

// @desc   Get my properties
// @route  GET /properties/my
// @access Private (owner)
export const getMyProperties = asyncHandler(async (req, res) => {
  const properties = await getMyPropertiesService(req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.myListRetrieved"),
    data: { properties },
  });
});

// @desc   Update property
// @route  PUT /properties/:id
// @access Private (owner / admin)
export const updateProperty = asyncHandler(async (req, res) => {
  const isAdmin =
    Array.isArray(req.user?.roles) &&
    req.user.roles.some((r) => ["admin", "super_admin"].includes(r));

  const property = await updatePropertyService(
    req.params.id,
    req.user.id,
    req.body,
    req.t,
    isAdmin,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.updated"),
    data: { property },
  });
});

// @desc   Delete property (soft delete)
// @route  DELETE /properties/:id
// @access Private (owner / admin)
export const deleteProperty = asyncHandler(async (req, res) => {
  const isAdmin =
    Array.isArray(req.user?.roles) &&
    req.user.roles.some((r) => ["admin", "super_admin"].includes(r));

  await deletePropertyService(req.params.id, req.user.id, req.t, isAdmin);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.deleted"),
    data: null,
  });
});

// @desc   Toggle availability
// @route  PATCH /properties/:id/availability
// @access Private (owner / admin)
export const toggleAvailability = asyncHandler(async (req, res) => {
  const isAdmin =
    Array.isArray(req.user?.roles) &&
    req.user.roles.some((r) => ["admin", "super_admin"].includes(r));

  const property = await toggleAvailabilityService(
    req.params.id,
    req.user.id,
    req.body?.isAvailable,
    req.t,
    isAdmin,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.availabilityUpdated"),
    data: { property },
  });
});

// @desc   Get pending properties (Admin)
// @route  GET /properties/pending
// @access Private (admin)
export const getPendingProperties = asyncHandler(async (req, res) => {
  const properties = await getPendingPropertiesService(req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.pendingRetrieved"),
    data: { properties },
  });
});

// @desc   Review property - approve/reject (Admin)
// @route  PATCH /properties/:id/review
// @access Private (admin)
export const reviewProperty = asyncHandler(async (req, res) => {
  const property = await reviewPropertyService(
    req.params.id,
    req.user.id,
    req.body,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.reviewed"),
    data: { property },
  });
});

// @desc   Suspend property (Admin)
// @route  PATCH /properties/:id/suspend
// @access Private (admin)
export const suspendProperty = asyncHandler(async (req, res) => {
  const property = await suspendPropertyService(
    req.params.id,
    req.user.id,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.suspended"),
    data: { property },
  });
});