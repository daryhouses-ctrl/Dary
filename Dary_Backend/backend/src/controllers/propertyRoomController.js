import asyncHandler from "express-async-handler";
import {
  addPropertyRoomService,
  updatePropertyRoomService,
  uploadRoomPhotoService,
  deletePropertyRoomService,
} from "../services/propertyRoomServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

const checkIsAdmin = (req) =>
  Array.isArray(req.user?.roles) &&
  req.user.roles.some((r) => ["admin", "super_admin"].includes(r));

// @desc   Add room to property
// @route  POST /properties/:propertyId/rooms
// @access Private (owner / admin)
export const addPropertyRoom = asyncHandler(async (req, res) => {
  const room = await addPropertyRoomService(
    req.params.propertyId,
    req.user.id,
    req.body,
    req.file,
    req.t,
    checkIsAdmin(req),
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("property.roomAdded"),
    data: { room },
  });
});

// @desc   Update room data
// @route  PATCH /properties/rooms/:roomId
// @access Private (owner / admin)
export const updatePropertyRoom = asyncHandler(async (req, res) => {
  const room = await updatePropertyRoomService(
    req.params.roomId,
    req.user.id,
    req.body,
    req.t,
    checkIsAdmin(req),
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.roomUpdated"),
    data: { room },
  });
});

// @desc   Upload / replace room photo
// @route  PATCH /properties/rooms/:roomId/photo
// @access Private (owner / admin)
export const uploadRoomPhoto = asyncHandler(async (req, res) => {
  const room = await uploadRoomPhotoService(
    req.params.roomId,
    req.user.id,
    req.file,
    req.t,
    checkIsAdmin(req),
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.roomPhotoUpdated"),
    data: { room },
  });
});

// @desc   Delete room
// @route  DELETE /properties/rooms/:roomId
// @access Private (owner / admin)
export const deletePropertyRoom = asyncHandler(async (req, res) => {
  await deletePropertyRoomService(
    req.params.roomId,
    req.user.id,
    req.t,
    checkIsAdmin(req),
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("property.roomDeleted"),
    data: null,
  });
});