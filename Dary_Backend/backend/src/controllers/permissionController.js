import asyncHandler from "express-async-handler";
import {
  findAllPermissionsService,
  createPermissionService,
  updatePermissionService,
  removePermissionService,
  assignPermissionsToRoleService,
  getRolePermissionsService,
  removePermissionFromRoleService,
} from "../services/permissionServices.js";
import { sendSuccess } from "../utils/apiResponse.js";

// @desc Get all permissions
// @route GET /permissions
// @access Private
export const findAllPermissions = asyncHandler(async (req, res) => {
  const permissions = await findAllPermissionsService(req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("permission.fetched"),
    data: { permissions },
  });
});

// @desc Create a new permission
// @route POST /permissions
// @access Private
export const createPermission = asyncHandler(async (req, res) => {
  const permission = await createPermissionService(req.body, req.t);

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("permission.createSuccess"),
    data: { permission },
  });
});

// @desc Update a permission
// @route PUT /permissions/:id
// @access Private
export const updatePermission = asyncHandler(async (req, res) => {
  const permission = await updatePermissionService(
    req.params.id,
    req.body,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("permission.updateSuccess"),
    data: { permission },
  });
});

// @desc Remove a permission
// @route DELETE /permissions/:id
// @access Private
export const removePermission = asyncHandler(async (req, res) => {
  const result = await removePermissionService(req.params.id, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("permission.removeSuccess"),
    data: result,
  });
});

// @desc Assign permissions to a role
// @route POST /permissions/role
// @access Private
export const assignPermissionsToRole = asyncHandler(async (req, res) => {
  const result = await assignPermissionsToRoleService(req.body, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("permission.assignedToRole"),
    data: result,
  });
});

// @desc Get role permissions
// @route GET /permissions/role/:roleId
// @access Private
export const getRolePermissions = asyncHandler(async (req, res) => {
  const permissions = await getRolePermissionsService(req.params.roleId, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("permission.fetched"),
    data: { permissions },
  });
});

// @desc Remove permission from a role
// @route DELETE /permissions/role/:roleId/:permissionId
// @access Private
export const removePermissionFromRole = asyncHandler(async (req, res) => {
  const result = await removePermissionFromRoleService(
    req.params.roleId,
    req.params.permissionId,
    req.t,
  );

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("permission.removedFromRole"),
    data: result,
  });
});