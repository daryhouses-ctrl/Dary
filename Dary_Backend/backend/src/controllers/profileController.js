import asyncHandler from "express-async-handler";
import {
  getMyProfileService,
  upsertProfileService,
  getPublicProfileService,
  updateAvatarService,
  deleteAvatarService,
} from "../services/profileServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

// @desc   Get my profile
// @route  GET /profile/me
// @access Private
export const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await getMyProfileService(req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("profile.retrieved"),
    data: { profile },
  });
});

// @desc   Create or update my profile
// @route  PUT /profile/me
// @access Private
export const upsertProfile = asyncHandler(async (req, res) => {
  const profile = await upsertProfileService(req.user.id, req.body, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("profile.updateSuccess"),
    data: { profile },
  });
});

// @desc   Get another user's public profile (limited fields)
// @route  GET /profile/:userId
// @access Public
export const getPublicProfile = asyncHandler(async (req, res) => {
  const profile = await getPublicProfileService(req.params.userId, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("profile.publicRetrieved"),
    data: { profile },
  });
});

// @desc   Update my avatar
// @route  PATCH /profile/avatar
// @access Private
export const updateAvatar = asyncHandler(async (req, res) => {
  const avatar = await updateAvatarService(req.user.id, req.file, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("profile.avatarUpdated"),
    data: { avatar },
  });
});

// @desc   Delete my avatar
// @route  DELETE /profile/avatar
// @access Private
export const deleteAvatar = asyncHandler(async (req, res) => {
  await deleteAvatarService(req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("profile.avatarDeleted"),
    data: null,
  });
});