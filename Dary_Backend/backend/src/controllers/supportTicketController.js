import asyncHandler from "express-async-handler";

import {
  createTicketService,
  getMyTicketsService,
  getTicketByIdService,
  addTicketMessageService,
  updateTicketStatusService,
  getAllTicketsService,
} from "../services/supportTicketServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

const isAdminUser = (req) =>
  req.user.roles?.includes("admin") ||
  req.user.roles?.includes("super_admin");

// @desc   Create ticket
// @route  POST /tickets
// @access Private
export const createTicket = asyncHandler(async (req, res) => {
  const ticket = await createTicketService(req.user.id, req.body, req.t);

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("ticket.created"),
    data: { ticket },
  });
});

// @desc   Get my tickets
// @route  GET /tickets/my
// @access Private
export const getMyTickets = asyncHandler(async (req, res) => {
  const tickets = await getMyTicketsService(req.user.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("ticket.myListRetrieved"),
    data: { tickets },
  });
});

// @desc   Get ticket by ID
// @route  GET /tickets/:id
// @access Private (owner/admin)
export const getTicketById = asyncHandler(async (req, res) => {
  const ticket = await getTicketByIdService(
    req.params.id,
    req.user.id,
    isAdminUser(req),
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("ticket.retrieved"),
    data: { ticket },
  });
});

// @desc   Add message to ticket
// @route  POST /tickets/:id/messages
// @access Private (owner/admin)
export const addTicketMessage = asyncHandler(async (req, res) => {
  const { message } = req.body;

  const newMessage = await addTicketMessageService(
    req.params.id,
    req.user.id,
    message,
    req.files,
    isAdminUser(req),
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("ticket.messageSent"),
    data: { message: newMessage },
  });
});

// @desc   Update ticket status
// @route  PATCH /tickets/:id/status
// @access Private (admin)
export const updateTicketStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const ticket = await updateTicketStatusService(
    req.params.id,
    req.user.id,
    status,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("ticket.statusUpdated"),
    data: { ticket },
  });
});

// @desc   Get all tickets (Admin)
// @route  GET /tickets
// @access Private (admin)
export const getAllTickets = asyncHandler(async (req, res) => {
  const result = await getAllTicketsService(req.query, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("ticket.listRetrieved"),
    data: result,
  });
});