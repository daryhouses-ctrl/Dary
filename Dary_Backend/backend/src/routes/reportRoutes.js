import { Router } from "express";

import {
  createReport,
  getMyReports,
  getReportById,
  getAllReports,
  updateReportPriority,
  resolveReport,
} from "../controllers/reportController.js";

import authMiddleware from "../core/middleware/authMiddleware.js";
import { requirePermission } from "../core/middleware/permissionMiddleware.js";
import validate from "../core/middleware/ValidateMiddleware.js";
import { validateUUID } from "../core/middleware/ValidateId.js";

import {
  createReportSchema,
  updateReportPrioritySchema,
  resolveReportSchema,
  getAllReportsQuerySchema,
} from "../validation/reportValidation.js";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("report.create"),
  validate(createReportSchema, "body"),
  createReport,
);

router.get(
  "/my",
  authMiddleware,
  requirePermission("report.read_own"),
  getMyReports,
);

router.get(
  "/",
  authMiddleware,
  requirePermission("report.read"),
  validate(getAllReportsQuerySchema, "query"),
  getAllReports,
);

router.patch(
  "/:id/priority",
  authMiddleware,
  requirePermission("report.priority.update"),
  validateUUID,
  validate(updateReportPrioritySchema, "body"),
  updateReportPriority,
);

router.patch(
  "/:id/resolve",
  authMiddleware,
  requirePermission("report.resolve"),
  validateUUID,
  validate(resolveReportSchema, "body"),
  resolveReport,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("report.read"),
  validateUUID,
  getReportById,
);

export default router;
