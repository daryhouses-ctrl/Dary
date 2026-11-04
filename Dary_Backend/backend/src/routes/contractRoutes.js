import { Router } from "express";

import {
  createContract,
  sendContract,
  tenantSignContract,
  ownerSignContract,
  activateContract,
  cancelContract,
  getContractById,
  getContractByBookingId,
  getAllContracts,
} from "../controllers/contractController.js";

import authMiddleware from "../core/middleware/authMiddleware.js";
import { uploadDocument } from "../core/middleware/Upload/documentUploadMiddleware.js";
import { requirePermission } from "../core/middleware/permissionMiddleware.js";

import validate from "../core/middleware/ValidateMiddleware.js";
import { validateUUID } from "../core/middleware/ValidateId.js";

import {
  createContractSchema,
  getAllContractsQuerySchema,
  validatePdfFilePresence,
} from "../validation/contractValidation.js";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("contract.create"),
  validate(createContractSchema, "body"),
  createContract,
);

router.get(
  "/",
  authMiddleware,
  requirePermission("contract.read_all"),
  getAllContracts,
);

router.patch(
  "/:id/send",
  authMiddleware,
  requirePermission("contract.send_to_tenant"),
  validateUUID,
  uploadDocument.single("pdf"),
  validatePdfFilePresence,
  sendContract,
);

router.patch(
  "/:id/activate",
  authMiddleware,
  requirePermission("contract.activate"),
  validateUUID,
  activateContract,
);

router.patch(
  "/:id/cancel",
  authMiddleware,
  requirePermission("contract.cancel"),
  validateUUID,
  cancelContract,
);

router.patch(
  "/:id/tenant-sign",
  authMiddleware,
  requirePermission("contract.tenant_sign"),
  validateUUID,
  uploadDocument.single("pdf"),
  validatePdfFilePresence,
  tenantSignContract,
);

router.patch(
  "/:id/owner-sign",
  authMiddleware,
  requirePermission("contract.owner_sign"),
  validateUUID,
  uploadDocument.single("pdf"),
  validatePdfFilePresence,
  ownerSignContract,
);

router.get(
  "/booking/:bookingId",
  authMiddleware,
  requirePermission("contract.read_by_booking"),
  validateUUID,
  getContractByBookingId,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission("contract.read"),
  validateUUID,
  getContractById,
);

export default router;
