import { Router } from "express";
import {
  register,
  login,
  logout,
  refreshToken,
  verifyOtp,
  resendOtp,
  forgetPassword,
  resetPassword,
  findUser,
  updateUserStatus,
  googleCallback,
  deleteAccount,
  createAdminController,
} from "../controllers/authController.js";
import authMiddleware, {
  optionalAuthMiddleware,
} from "../core/middleware/authMiddleware.js";
import {
  googleAuth,
  googleAuthenticate,
} from "../core/middleware/googlePassport.js";

import validate from "../core/middleware/ValidateMiddleware.js";
import { validateUUID } from "../core/middleware/ValidateId.js";

import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgetPasswordSchema,
  resetPasswordSchema,
} from "../validation/authValidation.js";

import {
  requirePermission,
  requireRole,
} from "../core/middleware/permissionMiddleware.js";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);

router.post("/refresh-token", refreshToken);

router.post("/verify-otp", validate(verifyOtpSchema), verifyOtp);

router.post("/resend-otp", validate(resendOtpSchema), resendOtp);

router.post("/forget-password", validate(forgetPasswordSchema), forgetPassword);

router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

//Google Authentication
router.get("/google", googleAuth);

router.get("/google/callback", googleAuthenticate, googleCallback);

router.post("/logout", optionalAuthMiddleware, logout);

router.post("/create-admin", createAdminController);

router.get("/users", authMiddleware, requirePermission("user.read"), findUser);

router.patch(
  "/users/:userId/status",
  authMiddleware,
  requirePermission("user.status.update"),
  updateUserStatus,
);

router.delete(
  "/delete",
  authMiddleware,
  requirePermission("user.delete"),
  validateUUID,
  deleteAccount,
);

export default router;
