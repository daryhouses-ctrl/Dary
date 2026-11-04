import asyncHandler from "express-async-handler";
import { setAuthCookies, clearAuthCookies } from "../utils/setAuthCookies.js";
import { sendSuccess } from "../utils/apiResponse.js";
import {
  registerUser,
  loginUser,
  refreshUserToken,
  logoutUser,
  verifyOtpService,
  resendOtpService,
  forgetPasswordService,
  resetPasswordService,
  getAllUsers,
  googleLoginService,
  updateUserStatusService,
  deleteUserService,
  createAdminService,
} from "../services/authServices.js";

// @desc Register user
// @route POST /auth/register
// @access Public
export const register = asyncHandler(async (req, res) => {
  const result = await registerUser(req.body, req.t);

  return sendSuccess(res, {
    statusCode: 201,
    message: req.t("register.success"),
    data: { user: result.user },
  });
});

// @desc Login user
// @route POST /auth/login
// @access Public
export const login = asyncHandler(async (req, res) => {
  const { user, tokens } = await loginUser(req.body, req.t);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("login.success"),
    data: {
      user,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    },
  });
});

// @desc Logout user
// @route POST /auth/logout
// @access Public / Optional Auth
export const logout = asyncHandler(async (req, res) => {
  const refreshTokenCookie =
    req.cookies?.RefreshToken ||
    req.cookies?.refreshToken ||
    req.body?.refreshToken;
  try {
    await logoutUser(refreshTokenCookie, req.user?.id);
  } catch (err) {
    // Ignore errors when revoking already revoked/invalid token
  }
  clearAuthCookies(res);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("logout.success"),
    data: null,
  });
});

// @desc Refresh token
// @route POST /auth/refresh-token
// @access Public
export const refreshToken = asyncHandler(async (req, res) => {
  const token =
    req.cookies?.RefreshToken ||
    req.cookies?.refreshToken ||
    req.body?.refreshToken;
  const { user, tokens } = await refreshUserToken(token, req.t);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("token.refreshed"),
    data: {
      user,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    },
  });
});

// @desc Verify OTP (email or phone verification)
// @route POST /auth/verify-otp
// @access Public
export const verifyOtp = asyncHandler(async (req, res) => {
  await verifyOtpService(req.body, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("otp.verifySuccess"),
    data: null,
  });
});

// @desc Resend OTP
// @route POST /auth/resend-otp
// @access Public
export const resendOtp = asyncHandler(async (req, res) => {
  await resendOtpService(req.body, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("otp.sent"),
    data: null,
  });
});

// @desc Request password reset
// @route POST /auth/forget-password
// @access Public
export const forgetPassword = asyncHandler(async (req, res) => {
  await forgetPasswordService(req.body, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("resetPassword.linkSent"),
    data: null,
  });
});

// @desc Reset password using token
// @route POST /auth/reset-password
// @access Public
// body: { userId, resetToken, newPassword }
export const resetPassword = asyncHandler(async (req, res) => {
  await resetPasswordService(req.body, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("resetPassword.success"),
    data: null,
  });
});

// @desc Get all users
// @route GET /auth/found-user
// @access Private
export const findUser = asyncHandler(async (req, res) => {
  const users = await getAllUsers(req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("users.fetched"),
    data: { users },
  });
});

// @desc Update user status (Active or Deactive)
// @route PATCH /admin/users/:userId/status
// @access Private - Admin
export const updateUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  const result = await updateUserStatusService(userId, status, req.t);

  return sendSuccess(res, {
    statusCode: 200,
    message:
      status === "ACTIVE"
        ? "User activated successfully"
        : "User deactivated successfully",
    data: { user: result },
  });
});

// @desc Delete own account
// @route DELETE /auth/delete
// @access Private
export const deleteAccount = asyncHandler(async (req, res) => {
  await deleteUserService(req.user.id, req.t);
  clearAuthCookies(res);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("account.deleted"),
    data: null,
  });
});

// @desc Google login
// @route GET /auth/google/callback
// @access Public
export const googleCallback = asyncHandler(async (req, res) => {
  const { user, tokens } = await googleLoginService(req.user, req.t);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  return sendSuccess(res, {
    statusCode: 200,
    message: req.t("googleLogin.success"),
    data: { user },
  });
});

// @desc Create Admin user directly (Active and Verified without OTP)
// @route POST /auth/create-admin
// @access Private (or Admin)
export const createAdminController = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, email, phone, password } = req.body;
  if (!email || !password || !firstName) {
    return res.status(400).json({
      success: false,
      message: "الاسم الأول والبريد الإلكتروني وكلمة المرور مطلوبة.",
    });
  }

  const newUser = await createAdminService({
    firstName,
    lastName,
    email,
    phone,
    password,
  });

  return res.status(201).json({
    success: true,
    message: "تم إنشاء حساب المسؤول وتفعيله بنجاح.",
    data: {
      user: newUser,
    },
  });
});