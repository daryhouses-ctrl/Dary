import asyncHandler from "express-async-handler";
import {
  findAllRolesService,
  assignRoleService,
  removeRoleService,
  getUserRolesService,
  createRoleService,
} from "../services/roleServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

// @desc   Create a new role
// @route  POST /roles
// @access Private
export const createRole = asyncHandler(async (req, res) => {
  const role = await createRoleService(req.body, req.t);

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("role.created"),
    data: { role },
  });
});

// @desc   Get all roles
// @route  GET /roles
// @access Private
export const findAllRoles = asyncHandler(async (req, res) => {
  const roles = await findAllRolesService(req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("role.listRetrieved"),
    data: { roles },
  });
});

// @desc   Assign a role to a user
// @route  POST /roles/assign
// @access Private
export const assignRole = asyncHandler(async (req, res) => {
  const result = await assignRoleService(req.body, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("role.assigned"),
    data: result,
  });
});

// @desc   Remove a role from a user
// @route  DELETE /roles/remove
// @access Private
export const removeRole = asyncHandler(async (req, res) => {
  const result = await removeRoleService(req.body, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("role.removed"),
    data: result,
  });
});

// @desc   Get user roles
// @route  GET /roles/user/:userId
// @access Private
export const getUserRoles = asyncHandler(async (req, res) => {
  const roles = await getUserRolesService(req.params.userId, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("role.userRolesRetrieved"),
    data: { roles },
  });
});