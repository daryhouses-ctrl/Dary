import asyncHandler from "express-async-handler";
import {
  createBookingService,
  getMyBookingsService,
  getBookingByIdService,
  getPropertyBookingsService,
  getAllBookingsService,
  assignAdminToBookingService,
  updateBookingStatusService,
  cancelBookingService,
} from "../services/bookingServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

// @desc Create booking (returns whatsapp link)
// @route POST /bookings
// @access Private (tenant)
export const createBooking = asyncHandler(async (req, res) => {
  const { booking, whatsappLink } = await createBookingService(
    req.user.id,
    req.body,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("booking.created"),
    data: { booking, whatsappLink },
  });
});



// @desc Get my bookings
// @route GET /bookings/my
// @access Private (tenant)
export const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await getMyBookingsService(req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("booking.fetched"),
    data: { bookings },
  });
});

// @desc Get single booking
// @route GET /bookings/:id
// @access Private (tenant/admin)
export const getBookingById = asyncHandler(async (req, res) => {
  const isAdmin =
    req.user.roles?.includes("admin") ||
    req.user.roles?.includes("super_admin");
  const booking = await getBookingByIdService(
    req.params.id,
    req.user.id,
    isAdmin,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("booking.fetched"),
    data: { booking },
  });
});

// @desc Get bookings for a property (Owner)
// @route GET /properties/:propertyId/bookings
// @access Private (owner)
export const getPropertyBookings = asyncHandler(async (req, res) => {
  const bookings = await getPropertyBookingsService(
    req.params.propertyId,
    req.user.id,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("booking.fetched"),
    data: { bookings },
  });
});

// @desc Get all bookings (Admin)
// @route GET /bookings
// @access Private (admin)
export const getAllBookings = asyncHandler(async (req, res) => {
  const result = await getAllBookingsService(req.query, req.t);

  // NOTE: if getAllBookingsService already returns { bookings, pagination, ... }
  // this passes it straight through under "data" so nothing on the frontend breaks.
  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("booking.fetched"),
    data: result,
  });
});

// @desc Assign admin to booking
// @route PATCH /bookings/:id/assign
// @access Private (admin)
export const assignAdminToBooking = asyncHandler(async (req, res) => {
  const booking = await assignAdminToBookingService(
    req.params.id,
    req.user.id,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("booking.assigned"),
    data: { booking },
  });
});

// @desc Update booking status
// @route PATCH /bookings/:id/status
// @access Private (admin)
export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const booking = await updateBookingStatusService(
    req.params.id,
    req.user.id,
    status,
    note,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("booking.statusUpdated"),
    data: { booking },
  });
});

// @desc Cancel booking (Tenant)
// @route PATCH /bookings/:id/cancel
// @access Private (tenant)
export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await cancelBookingService(req.params.id, req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("booking.cancelled"),
    data: { booking },
  });
});