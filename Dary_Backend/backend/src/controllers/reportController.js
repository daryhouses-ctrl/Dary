import asyncHandler from "express-async-handler";
import {
  createReportService,
  getMyReportsService,
  getReportByIdService,
  getAllReportsService,
  updateReportPriorityService,
  resolveReportService,
} from "../services/reportServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

// @desc   Create report
// @route  POST /reports
// @access Private (any authenticated user)
export const createReport = asyncHandler(async (req, res) => {
  const report = await createReportService(req.user.id, req.body, req.t);

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("report.created"),
    data: { report },
  });
});

// @desc   Get my reports
// @route  GET /reports/my
// @access Private
export const getMyReports = asyncHandler(async (req, res) => {
  const reports = await getMyReportsService(req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("report.myListRetrieved"),
    data: { reports },
  });
});

// @desc   Get single report
// @route  GET /reports/:id
// @access Private (reporter/admin)
export const getReportById = asyncHandler(async (req, res) => {
  const isAdmin =
    req.user.roles?.includes("admin") ||
    req.user.roles?.includes("super_admin");
  const report = await getReportByIdService(
    req.params.id,
    req.user.id,
    isAdmin,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("report.retrieved"),
    data: { report },
  });
});

// @desc   Get all reports (Admin)
// @route  GET /reports
// @access Private (admin)
export const getAllReports = asyncHandler(async (req, res) => {
  const result = await getAllReportsService(req.query, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("report.listRetrieved"),
    data: result,
  });
});

// @desc   Update report priority (Admin)
// @route  PATCH /reports/:id/priority
// @access Private (admin)
export const updateReportPriority = asyncHandler(async (req, res) => {
  const { priority } = req.body;
  const report = await updateReportPriorityService(
    req.params.id,
    priority,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("report.priorityUpdated"),
    data: { report },
  });
});

// @desc   Resolve report (Admin)
// @route  PATCH /reports/:id/resolve
// @access Private (admin)
export const resolveReport = asyncHandler(async (req, res) => {
  const { resolutionNotes } = req.body;
  const report = await resolveReportService(
    req.params.id,
    req.user.id,
    resolutionNotes,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("report.resolved"),
    data: { report },
  });
});