import { Router } from "express";

import {
  createTicket,
  getMyTickets,
  getTicketById,
  addTicketMessage,
  updateTicketStatus,
  getAllTickets,
} from "../controllers/supportTicketController.js";

import authMiddleware from "../core/middleware/authMiddleware.js";
import { requirePermission } from "../core/middleware/permissionMiddleware.js";

import { uploadAttachment } from "../core/middleware/Upload/attachmentUploadMiddleware.js";

import validate from "../core/middleware/ValidateMiddleware.js";
import { validateUUID } from "../core/middleware/ValidateId.js";

import {
  createTicketSchema,
  addTicketMessageSchema,
  updateTicketStatusSchema,
  getAllTicketsQuerySchema,
} from "../validation/supportTicketValidation.js";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("support_ticket.create"),
  validate(createTicketSchema, "body"),
  createTicket,
);

router.get(
  "/my",
  authMiddleware,
  requirePermission("support_ticket.read_own"),
  getMyTickets,
);

router.get(
  "/",
  authMiddleware,
  requirePermission("support_ticket.read"),
  getAllTickets,
);

router.patch(
  "/:id/status",
  authMiddleware,
  requirePermission("support_ticket.status.update"),
  validateUUID,
  validate(updateTicketStatusSchema, "body"),
  updateTicketStatus,
);

router.post(
  "/:id/messages",
  authMiddleware,
  requirePermission("support_ticket.message.create"),
  validateUUID,
  uploadAttachment.array("attachments", 5),
  validate(addTicketMessageSchema, "body"),
  addTicketMessage,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("support_ticket.read_own"),
  validateUUID,
  getTicketById,
);

export default router;