import { Router } from "express";

import {
  createBooking,
  getMyBookings,
  getBookingById,
  getPropertyBookings,
  getAllBookings,
  assignAdminToBooking,
  updateBookingStatus,
  cancelBooking,

} from "../controllers/bookingController.js";

import authMiddleware from "../core/middleware/authMiddleware.js";
import { requirePermission } from "../core/middleware/permissionMiddleware.js";
import validate from "../core/middleware/ValidateMiddleware.js";
import { validateUUID } from "../core/middleware/ValidateId.js";
import {
  createBookingSchema,
  updateBookingStatusSchema,
  getAllBookingsQuerySchema,
} from "../validation/bookingValidation.js";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("booking.create"),
  validate(createBookingSchema),
  createBooking,
);

router.get(
  "/my",
  authMiddleware,
  requirePermission("booking.read_own"),
  getMyBookings,
);

router.patch(
  "/:id/cancel",
  authMiddleware,
  requirePermission("booking.cancel"),
  validateUUID,
  cancelBooking,
);

router.get(
  "/property/:propertyId",
  authMiddleware,
  requirePermission("booking.read_property"),
  validateUUID,
  getPropertyBookings,
);

router.get(
  "/",
  authMiddleware,
  requirePermission("booking.read"),
  getAllBookings,
);

router.patch(
  "/:id/assign",
  authMiddleware,
  requirePermission("booking.assign_admin"),
  validateUUID,
  assignAdminToBooking,
);

// id = id booking
// Update booking status
router.patch(
  "/:id/status",
  authMiddleware,
  requirePermission("booking.status.update"),
  validateUUID,
  validate(updateBookingStatusSchema),
  updateBookingStatus,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("booking.read"),
  validateUUID,
  getBookingById,
);



export default router;
