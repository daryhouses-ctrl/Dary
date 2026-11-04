import asyncHandler from "express-async-handler";
import {
  createContractService,
  sendContractService,
  tenantSignContractService,
  ownerSignContractService,
  activateContractService,
  cancelContractService,
  getContractByIdService,
  getContractByBookingIdService,
  getAllContractsService,
} from "../services/contractServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

// @desc Create contract for a booking (after WhatsApp negotiation)
// @route POST /contracts
// @access Private (admin)
export const createContract = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  const contract = await createContractService(req.user.id, bookingId, req.t);

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("contract.created"),
    data: { contract },
  });
});

// @desc Admin uploads draft PDF and sends it to BOTH tenant and owner
// @route PATCH /contracts/:id/send
// @access Private (admin)
export const sendContract = asyncHandler(async (req, res) => {
  const contract = await sendContractService(
    req.params.id,
    req.user.id,
    req.file,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("contract.sent"),
    data: { contract },
  });
});

// @desc Tenant uploads their signed copy (independent of owner)
// @route PATCH /contracts/:id/tenant-sign
// @access Private (tenant)
export const tenantSignContract = asyncHandler(async (req, res) => {
  const contract = await tenantSignContractService(
    req.params.id,
    req.user.id,
    req.file,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("contract.tenantSigned"),
    data: { contract },
  });
});

// @desc Owner uploads their signed copy (independent of tenant)
// @route PATCH /contracts/:id/owner-sign
// @access Private (owner)
export const ownerSignContract = asyncHandler(async (req, res) => {
  const contract = await ownerSignContractService(
    req.params.id,
    req.user.id,
    req.file,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("contract.ownerSigned"),
    data: { contract },
  });
});

// @desc Admin activates the contract (locks the bed)
// @route PATCH /contracts/:id/activate
// @access Private (admin)
export const activateContract = asyncHandler(async (req, res) => {
  const contract = await activateContractService(
    req.params.id,
    req.user.id,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("contract.activated"),
    data: { contract },
  });
});

// @desc Cancel contract (restores beds if it was ACTIVE)
// @route PATCH /contracts/:id/cancel
// @access Private (admin)
export const cancelContract = asyncHandler(async (req, res) => {
  const contract = await cancelContractService(
    req.params.id,
    req.user.id,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("contract.cancelled"),
    data: { contract },
  });
});

// @desc Get single contract
// @route GET /contracts/:id
// @access Private (tenant/owner/admin)
export const getContractById = asyncHandler(async (req, res) => {
  const isAdmin =
    req.user.roles?.includes("admin") ||
    req.user.roles?.includes("super_admin");

  const contract = await getContractByIdService(
    req.params.id,
    req.user.id,
    isAdmin,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("contract.fetched"),
    data: { contract },
  });
});

// @desc Get contract by booking id
// @route GET /contracts/booking/:bookingId
// @access Private (tenant/owner/admin)
export const getContractByBookingId = asyncHandler(async (req, res) => {
  const isAdmin =
    req.user.roles?.includes("admin") ||
    req.user.roles?.includes("super_admin");

  const contract = await getContractByBookingIdService(
    req.params.bookingId,
    req.user.id,
    isAdmin,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("contract.fetched"),
    data: { contract },
  });
});

// @desc Get all contracts (Admin)
// @route GET /contracts
// @access Private (admin)
export const getAllContracts = asyncHandler(async (req, res) => {
  const result = await getAllContractsService(req.query, req.t);

  // NOTE: same as bookings — if getAllContractsService already returns
  // { contracts, pagination, ... } it's passed straight through under "data".
  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("contract.fetched"),
    data: result,
  });
});