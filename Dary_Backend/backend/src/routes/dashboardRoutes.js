import { Router } from "express";

import authMiddleware from "../core/middleware/authMiddleware.js";
import { requirePermission } from "../core/middleware/permissionMiddleware.js";

import {
  getPropertiesStatus,
  getDashboardProperties,
  getUsersStatus,
  getDashboardUsers,
  getBookingsStatus,
  getDashboardBookings,
  getBookingCalendar,
  getReportsStatus,
  getDashboardReports,
  getAnalytics,
  addRecentlyViewedProperty,
  getMyRecentlyViewedProperties,
  removeRecentlyViewedProperty,
  clearRecentlyViewedProperties,
  getMyRentals,
  getOwnerPropertiesStatus,
  getOwnerBookingsStatus,
  getBookingsRevenue,
  getOwnerBookingsRevenue,
  getBookingCalendarSummary,
  getOwnerBookingCalendarSummary,
} from "../controllers/dashboardController.js";

import { validateUUID } from "../core/middleware/ValidateId.js";

const router = Router();

router.get(
  "/properties/status",
  authMiddleware,
  requirePermission("dashboard.properties.read"),
  getPropertiesStatus,
);

router.get(
  "/properties",
  authMiddleware,
  requirePermission("dashboard.properties.read"),
  getDashboardProperties,
);

router.get(
  "/users/status",
  authMiddleware,
  requirePermission("dashboard.users.read"),
  getUsersStatus,
);

router.get(
  "/users",
  authMiddleware,
  requirePermission("dashboard.users.read"),
  getDashboardUsers,
);

router.get(
  "/bookings/status",
  authMiddleware,
  requirePermission("dashboard.bookings.read"),
  getBookingsStatus,
);

router.get(
  "/bookings",
  authMiddleware,
  requirePermission("dashboard.bookings.read"),
  getDashboardBookings,
);

router.get(
  "/bookings/revenue",
  authMiddleware,
  requirePermission("dashboard.bookings.revenue.read"),
  getBookingsRevenue,
);

router.get(
  "/reports/status",
  authMiddleware,
  requirePermission("dashboard.reports.read"),
  getReportsStatus,
);

router.get(
  "/reports",
  authMiddleware,
  requirePermission("dashboard.reports.read"),
  getDashboardReports,
);

router.get(
  "/analytics",
  authMiddleware,
  requirePermission("dashboard.analytics.read"),
  getAnalytics,
);

router.get(
  "/recently-viewed",
  authMiddleware,
  requirePermission("recently_viewed.read"),
  getMyRecentlyViewedProperties,
);

router.post(
  "/recently-viewed/:propertyId",
  authMiddleware,
  requirePermission("recently_viewed.create"),
  validateUUID,
  addRecentlyViewedProperty,
);

router.delete(
  "/recently-viewed/:propertyId",
  authMiddleware,
  requirePermission("recently_viewed.delete"),
  validateUUID,
  removeRecentlyViewedProperty,
);

router.delete(
  "/recently-viewed",
  authMiddleware,
  requirePermission("recently_viewed.clear"),
  clearRecentlyViewedProperties,
);

router.get(
  "/rentals",
  authMiddleware,
  requirePermission("rental.read_own"),
  getMyRentals,
);

router.get(
  "/owner/properties/status",
  authMiddleware,
  requirePermission("dashboard.properties.read"),
  getOwnerPropertiesStatus,
);

router.get(
  "/owner/bookings/status",
  authMiddleware,
  requirePermission("dashboard.bookings.read"),
  getOwnerBookingsStatus,
);

router.get(
  "/owner/bookings/revenue",
  authMiddleware,
  requirePermission("dashboard.owner.bookings.read"),
  getOwnerBookingsRevenue,
);


router.get(
  "/booking/calendar",
  authMiddleware,
  requirePermission("booking.read"),
  getBookingCalendar,
);

router.get(
  "/bookings/calendar",
  authMiddleware,
  requirePermission("booking.read"),
  getBookingCalendar,
);

router.get(
  "/calendar/summary",
  authMiddleware,
  requirePermission("booking.read"),
  getBookingCalendarSummary,
);


router.get(
  "/owner/calendar/summary",
  authMiddleware,
  requirePermission("booking.read"),
  getOwnerBookingCalendarSummary,
);

export default router;