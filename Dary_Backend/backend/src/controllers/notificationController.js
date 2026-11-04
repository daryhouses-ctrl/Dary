import asyncHandler from "express-async-handler";
import {
  getMyNotificationsService,
  markAsReadService,
  markAllAsReadService,
  deleteNotificationService,
  deleteAllReadService,
} from "../services/notificationServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

// @desc   Get my notifications
// @route  GET /api/notifications
// @access Private
export const getMyNotifications = asyncHandler(async (req, res) => {
  const result = await getMyNotificationsService(req.user.id, req.query, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("notification.fetched"),
    data: result,
  });
});

// @desc   Mark notification as read
// @route  PATCH /api/notifications/:id/read
// @access Private
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await markAsReadService(
    req.params.id,
    req.user.id,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("notification.markedAsRead"),
    data: { notification },
  });
});

// @desc   Mark all notifications as read
// @route  PATCH /api/notifications/read-all
// @access Private
export const markAllAsRead = asyncHandler(async (req, res) => {
  await markAllAsReadService(req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("notification.allMarkedAsRead"),
    data: null,
  });
});

// @desc   Delete notification
// @route  DELETE /api/notifications/:id
// @access Private
export const deleteNotification = asyncHandler(async (req, res) => {
  await deleteNotificationService(req.params.id, req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("notification.deleted"),
    data: null,
  });
});

// @desc   Delete all read notifications
// @route  DELETE /api/notifications/read
// @access Private
export const deleteAllRead = asyncHandler(async (req, res) => {
  await deleteAllReadService(req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("notification.allReadDeleted"),
    data: null,
  });
});