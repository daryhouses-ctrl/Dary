import asyncHandler from "express-async-handler";
import {
  getPropertiesStatusService,
  getDashboardPropertiesService,
  getUsersStatusService,
  getDashboardUsersService,
  getBookingsStatusService,
  getReportsStatusService,
  getAnalyticsService,
  addRecentlyViewedPropertyService,
  getMyRecentlyViewedPropertiesService,
  removeRecentlyViewedPropertyService,
  clearRecentlyViewedPropertiesService,
  getMyRentalsService,
  getOwnerPropertiesStatusService,
  getOwnerBookingsStatusService,
  getBookingsRevenueService,
  getOwnerBookingsRevenueService,
  getBookingsCalendarService,
  getBookingCalendarSummaryService,
  getOwnerBookingCalendarSummaryService,
} from "../services/dashboardServices.js";
import { getAllBookingsService } from "../services/bookingServices.js";
import { getAllReportsService } from "../services/reportServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

// @desc   Get reports Status (dashboard cards)
// @route  GET /dashboard/reports/Status
// @access Private (admin/super_admin)
export const getReportsStatus = asyncHandler(async (req, res) => {
  const status = await getReportsStatusService(req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("dashboard.reportsStatusFetched"),
    data: { status },
  });
});

// @desc   Get all reports with filters/sort/pagination
// @route  GET /dashboard/reports
// @access Private (admin/super_admin)
export const getDashboardReports = asyncHandler(async (req, res) => {
  const result = await getAllReportsService(req.query, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("dashboard.reportsFetched"),
    data: result,
  });
});

// @desc   Get bookings Status (dashboard cards)
// @route  GET /dashboard/bookings/Status
// @access Private (admin/super_admin)
export const getBookingsStatus = asyncHandler(async (req, res) => {
  const status = await getBookingsStatusService(req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("dashboard.bookingsStatusFetched"),
    data: { status },
  });
});

// @desc   Get all bookings with filters/sort/pagination
// @route  GET /dashboard/bookings
// @access Private (admin/super_admin)
export const getDashboardBookings = asyncHandler(async (req, res) => {
  const result = await getAllBookingsService(req.query, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("dashboard.bookingsFetched"),
    data: result,
  });
});

// @desc   Get properties Status (dashboard cards)
// @route  GET /dashboard/properties/Status
// @access Private (admin/super_admin)
export const getPropertiesStatus = asyncHandler(async (req, res) => {
  const status = await getPropertiesStatusService(req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("dashboard.propertiesStatusFetched"),
    data: { status },
  });
});

// @desc   Get all properties (all statuses) with filters/sort/pagination
// @route  GET /dashboard/properties
// @access Private (admin/super_admin)
export const getDashboardProperties = asyncHandler(async (req, res) => {
  const result = await getDashboardPropertiesService(req.query, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("dashboard.propertiesFetched"),
    data: result,
  });
});

// @desc   Get users Status (dashboard cards)
// @route  GET /dashboard/users/Status
// @access Private (admin/super_admin)
export const getUsersStatus = asyncHandler(async (req, res) => {
  const status = await getUsersStatusService(req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("dashboard.usersStatusFetched"),
    data: { status },
  });
});

// @desc   Get all users with filters/sort/pagination
// @route  GET /dashboard/users
// @access Private (admin/super_admin)
export const getDashboardUsers = asyncHandler(async (req, res) => {
  const result = await getDashboardUsersService(req.query, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("dashboard.usersFetched"),
    data: result,
  });
});

// @desc   Get analytics dashboard
// @route  GET /dashboard/analytics
// @access Private
export const getAnalytics = asyncHandler(async (req, res) => {
  const result = await getAnalyticsService(req.query, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("dashboard.analyticsFetched"),
    data: result,
  });
});

// @desc   Add property to recently viewed
// @route  POST /api/recently-viewed/:propertyId
// @access Private
export const addRecentlyViewedProperty = asyncHandler(async (req, res) => {
  const result = await addRecentlyViewedPropertyService(
    req.user.id,
    req.params.propertyId,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("recentlyViewed.added"),
    data: { recentlyViewed: result },
  });
});

// @desc   Get my recently viewed properties
// @route  GET /api/recently-viewed
// @access Private
export const getMyRecentlyViewedProperties = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const result = await getMyRecentlyViewedPropertiesService(
    req.user.id,
    page,
    limit,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("recentlyViewed.fetched"),
    data: result,
  });
});

// @desc   Remove property from recently viewed
// @route  DELETE /api/recently-viewed/:propertyId
// @access Private
export const removeRecentlyViewedProperty = asyncHandler(async (req, res) => {
  const result = await removeRecentlyViewedPropertyService(
    req.user.id,
    req.params.propertyId,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("recentlyViewed.removed"),
    data: result,
  });
});

// @desc   Clear all recently viewed properties
// @route  DELETE /api/recently-viewed
// @access Private
export const clearRecentlyViewedProperties = asyncHandler(async (req, res) => {
  const result = await clearRecentlyViewedPropertiesService(req.user.id);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("recentlyViewed.cleared"),
    data: result,
  });
});

// @desc   Get my rentals
// @route  GET /api/my-rentals
// @access Private
export const getMyRentals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const result = await getMyRentalsService(req.user.id, page, limit);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("rentals.fetched"),
    data: result,
  });
});

// @desc   Get owner properties status (dashboard cards)
// @route  GET /dashboard/owner/properties/status
// @access Private (owner)
export const getOwnerPropertiesStatus = asyncHandler(async (req, res) => {
  const result = await getOwnerPropertiesStatusService(req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("dashboard.ownerPropertiesStatusFetched"),
    data: result,
  });
});

// @desc   Get owner bookings status (dashboard cards)
// @route  GET /dashboard/owner/bookings/status
// @access Private (owner)
export const getOwnerBookingsStatus = asyncHandler(async (req, res) => {
  const result = await getOwnerBookingsStatusService(req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("dashboard.ownerBookingsStatusFetched"),
    data: result,
  });
});

// @desc   Get owner total bookings revenue
// @route  GET /dashboard/owner/bookings/revenue
// @access Private (owner)
export const getOwnerBookingsRevenue = asyncHandler(async (req, res) => {
  const ownerId = req.user.id;
  const result = await getOwnerBookingsRevenueService(ownerId, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("dashboard.ownerBookingsRevenueFetched"),
    data: result,
  });
});

// @desc   Get total revenue from completed bookings
// @route  GET /dashboard/bookings/revenue
// @access Private (admin/super_admin)
export const getBookingsRevenue = asyncHandler(async (req, res) => {
  const result = await getBookingsRevenueService(req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("dashboard.bookingsRevenueFetched"),
    data: result,
  });
});

// @desc   Get bookings calendar (with pagination, filters, and sort)
// @route  GET /dashboard/bookings/calendar
// @access Private (admin/super_admin)
export const getBookingCalendar = asyncHandler(async (req, res) => {
  const result = await getBookingsCalendarService(req.query, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("booking.calendarFetched"),
    data: {
      ...result,
      bookings: result.bookings,
    },
  });
});

// @desc   Get booking calendar summary
// @route  GET /dashboard/bookings/calendar/summary
// @access Private (admin/super_admin)
export const getBookingCalendarSummary = asyncHandler(async (req, res) => {
  const result = await getBookingCalendarSummaryService(req.query, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("booking.calendarSummaryFetched"),
    data: result,
  });
});

// @desc   Get owner booking calendar summary
// @route  GET /dashboard/owner/bookings/calendar/summary
// @access Private (owner)
export const getOwnerBookingCalendarSummary = asyncHandler(async (req, res) => {
  const result = await getOwnerBookingCalendarSummaryService(
    req.user.id,
    req.query,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("booking.ownerCalendarSummaryFetched"),
    data: result,
  });
});