import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppError } from "../core/middleware/error/AppError.js";
import { generateTokens, JWT_REFRESH_SECRET } from "../utils/Token.js";
import EmailService from "../core/email/EmailService.js";
import { logger } from "../shared/logger/logger.js";
import { prisma } from "../config/prisma/PrismaService.js";
import { setMemoryCache } from "../utils/memoryCache.js";
import { PrismaClientValidationError } from "@prisma/client/runtime/library";
import { parsePhoneNumberFromString } from "libphonenumber-js";

const OTP_EXPIRY_MINUTES = 2;
const RESET_PASSWORD_EXPIRY_MINUTES = 5;

// helper function
export function toSafeUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function generateNumericCode() {
  return crypto.randomInt(100000, 999999).toString();
}

function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function findLatestOtp(userId, type) {
  return prisma.otpCode.findFirst({
    where: { userId, type, verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

async function invalidatePreviousOtps(userId, type) {
  await prisma.otpCode.deleteMany({ where: { userId, type } });
}

async function createAndSendOtp({
  userId,
  email,
  type = "EMAIL_VERIFICATION",
  subject = "Verify your email",
  invalidatePrevious = false,
}) {
  if (invalidatePrevious) {
    await invalidatePreviousOtps(userId, type);
  }

  const otp = generateNumericCode();
  const hashedOtp = await bcrypt.hash(otp, 10);

  await prisma.otpCode.create({
    data: {
      userId,
      code: hashedOtp,
      type,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    },
  });

  await EmailService.sendOtpEmail({
    to: email,
    otp,
    subject,
  });
}

async function persistRefreshToken(userId, refreshToken) {
  const decoded = jwt.decode(refreshToken);
  const tokenHash = hashToken(refreshToken);

  try {
    // 1. امسح أي Refresh Token قديم لنفس المستخدم من الداتابيز نهائياً
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    // 2. احفظ التوكن الجديد فقط
    await prisma.refreshToken.create({
      data: {
        userId,
        token: tokenHash, // hash بدل raw
        expiresAt: new Date(decoded.exp * 1000),
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      console.log(
        "⚠️ Refresh token already persisted, ignoring duplicate insert",
      );
      return;
    }
    throw error;
  }
}

async function revokeRefreshTokenByValue(token) {
  const tokenHash = hashToken(token);
  // مسح نهائي من الداتابيز بدل isRevoked: true
  await prisma.refreshToken.deleteMany({
    where: { token: tokenHash },
  });
}
// to use in logout

async function verifyAndRetrieveRefreshToken(rawToken, t) {
  let decoded;
  try {
    decoded = jwt.verify(rawToken, JWT_REFRESH_SECRET);
  } catch (err) {
    throw new AppError(t("token.invalidOrExpired"), 401);
  }

  const tokenHash = hashToken(rawToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { token: tokenHash },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          isVerified: true,
          deletedAt: true,
          userRoles: {
            select: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!stored || stored.isRevoked) {
    throw new AppError(t("token.revoked"), 401);
  }

  if (new Date() > stored.expiresAt) {
    prisma.refreshToken
      .delete({
        where: { id: stored.id },
      })
      .catch(() => {});
    throw new AppError(t("token.expired"), 401);
  }

  if (!stored.user || stored.user.deletedAt) {
    throw new AppError(t("common.userNotFound"), 404);
  }

  if (stored.user.status === "SUSPENDED") {
    throw new AppError(t("common.accountSuspended"), 403);
  }

  if (stored.user.status === "INACTIVE") {
    throw new AppError(t("login.inactive"), 403);
  }

  return { decoded, stored, user: stored.user };
}

async function verifyAndConsumeRefreshToken(rawToken, t) {
  const { decoded, stored } = await verifyAndRetrieveRefreshToken(rawToken, t);
  await prisma.refreshToken.delete({
    where: { id: stored.id },
  });
  return decoded;
}

export async function registerUser(
  {
    firstName,
    lastName,
    email,
    password,
    phone,
    whatsappPhone,
    role: validatedRole,
    roles,
    roleName,
  },
  t,
) {
  const role = validatedRole || roleName || roles;
  const isOwnerWithoutEmail = role === "owner" && !email;

  const phoneVariants = [phone];
  if (phone.startsWith("+20")) {
    phoneVariants.push("0" + phone.slice(3));
  } else if (phone.startsWith("0")) {
    phoneVariants.push("+2" + phone);
  }

  const [existingEmail, existingPhone] = await Promise.all([
    email ? prisma.user.findUnique({ where: { email } }) : null,
    prisma.user.findFirst({
      where: {
        phone: { in: phoneVariants },
        deletedAt: null,
      },
    }),
  ]);

  // Existing email
  if (existingEmail) {
    if (existingEmail.isVerified) {
      throw new AppError(t("register.emailExists"), 400);
    }

    await createAndSendOtp({
      userId: existingEmail.id,
      email: existingEmail.email,
      invalidatePrevious: true,
    });

    return {
      user: toSafeUser(existingEmail),
    };
  }

  // Existing phone
  if (existingPhone) {
    throw new AppError(t("register.phoneExists"), 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { user } = await prisma.$transaction(async (tx) => {
    const roleRecord = await tx.role.findUnique({
      where: { name: role },
    });

    if (!roleRecord) {
      throw new AppError(t("role.notFound"), 404);
    }

    const user = await tx.user.create({
      data: {
        firstName,
        lastName,
        email: email || null,
        phone,
        whatsappPhone: whatsappPhone || null,
        password: hashedPassword,
        isVerified: isOwnerWithoutEmail,
        status: isOwnerWithoutEmail ? "ACTIVE" : "PENDING",
      },
    });

    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: roleRecord.id,
      },
    });

    return { user };
  });

  if (!isOwnerWithoutEmail && email) {
    await createAndSendOtp({
      userId: user.id,
      email,
    });
  }

  logger.info(
    {
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role,
      isOwnerWithoutEmail,
    },
    "User registered successfully",
  );

  return {
    user: toSafeUser(user),
  };
}

// Login
export async function loginUser({ email = "", password, phone = "" }, t) {
  const phoneEmailMatch = email.match(/^phone_(plus_)?(\d+)@dary\.com$/i);
  const extractedPhoneFromEmail = phoneEmailMatch
    ? `${phoneEmailMatch[1] ? "+" : ""}${phoneEmailMatch[2]}`
    : null;

  const isEmailFormat = email.includes("@") && !extractedPhoneFromEmail;
  const targetEmail = isEmailFormat ? email.toLowerCase() : null;
  const targetPhone =
    phone ||
    extractedPhoneFromEmail ||
    (!isEmailFormat && email ? email.replace(/\s+/g, "") : null);

  let targetPhoneE164 = targetPhone;
  let targetPhoneNational = null;
  if (targetPhone) {
    let clean = targetPhone.replace(/[\s\-\(\)\.]+/g, "");
    if (clean.startsWith("00")) clean = "+" + clean.slice(2);
    const parsed = clean.startsWith("+")
      ? parsePhoneNumberFromString(clean)
      : parsePhoneNumberFromString(clean, "EG");
    if (parsed && parsed.isValid()) {
      targetPhoneE164 = parsed.number;
      targetPhoneNational = parsed.nationalNumber ? `0${parsed.nationalNumber}` : null;
    }
  }

  const rows = await prisma.$queryRaw`
    SELECT
      u.id,
      u.first_name AS "firstName",
      u.last_name AS "lastName",
      u.email,
      u.phone,
      u.whatsapp_phone AS "whatsappPhone",
      u.password,
      u.avatar,
      u.avatar_public_id AS "avatarPublicId",
      u.status,
      u.is_verified AS "isVerified",
      u.last_login AS "lastLogin",
      u.created_at AS "createdAt",
      u.updated_at AS "updatedAt",
      u.deleted_at AS "deletedAt",
      COALESCE(
        json_agg(
          json_build_object(
            'id', ur.id,
            'userId', ur.user_id,
            'roleId', ur.role_id,
            'role', json_build_object('id', r.id, 'name', r.name)
          )
        ) FILTER (WHERE ur.id IS NOT NULL),
        '[]'::json
      ) AS "userRoles"
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE (
      (${targetEmail}::text IS NOT NULL AND u.email = ${targetEmail})
      OR (
        ${targetPhone}::text IS NOT NULL AND (
          u.phone = ${targetPhone}
          OR (${targetPhoneE164}::text IS NOT NULL AND u.phone = ${targetPhoneE164})
          OR (${targetPhoneNational}::text IS NOT NULL AND u.phone = ${targetPhoneNational})
        )
      )
    )
    AND u.deleted_at IS NULL
    GROUP BY u.id
    LIMIT 1
  `;

  const user = rows?.[0] || null;
  const identifierLabel = targetEmail || targetPhone;

  if (!user) {
    console.warn(
      `[AUTH DEBUG] Login failed: User "${identifierLabel}" not found.`,
    );
    throw new AppError(
      process.env.NODE_ENV === "development"
        ? `Invalid email/phone or password (User "${identifierLabel}" not found in database)`
        : t("login.invalidCredentials"),
      400,
    );
  }

  if (user.status === "SUSPENDED") {
    throw new AppError(t("common.accountSuspended"), 403);
  }

  if (user.status === "INACTIVE") {
    throw new AppError(t("login.inactive"), 403);
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    console.warn(
      `[AUTH DEBUG] Login failed: Password incorrect for user "${identifierLabel}".`,
    );
    throw new AppError(
      process.env.NODE_ENV === "development"
        ? `Invalid email/phone or password (Password incorrect for "${identifierLabel}")`
        : t("login.invalidCredentials"),
      400,
    );
  }

  if (!user.isVerified) {
    throw new AppError(t("login.notVerified"), 403);
  }

  const roles = (user.userRoles || [])
    .map((ur) => ur.role?.name || ur.name)
    .filter(Boolean);
  const primaryRole = roles[0] || "tenant";

  setMemoryCache(
    `user:status:${user.id}`,
    { id: user.id, status: user.status },
    180,
  );
  setMemoryCache(`user:roles:${user.id}`, roles, 180);

  const tokens = await generateTokens(user, roles);
  const lastLogin = new Date();

  Promise.all([
    persistRefreshToken(user.id, tokens.refreshToken),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLogin },
      select: { id: true },
    }),
  ]).catch((err) => {
    logger.error(
      { err: err.message, userId: user.id },
      "Background post-login persistence failed",
    );
  });

  return {
    user: {
      ...toSafeUser(user),
      lastLogin,
      role: primaryRole,
      roles,
      userRoles: user.userRoles,
    },
    tokens,
  };
}

// Refresh Token
export async function refreshUserToken(rawToken, t) {
  if (!rawToken) {
    throw new AppError(t("token.noTokenProvided"), 401);
  }

  const { stored, user } = await verifyAndRetrieveRefreshToken(rawToken, t);

  const roles = (user.userRoles || [])
    .map((ur) => ur.role?.name)
    .filter(Boolean);
  setMemoryCache(`user:roles:${user.id}`, roles, 180);
  setMemoryCache(
    `user:status:${user.id}`,
    { id: user.id, status: user.status },
    180,
  );

  const tokens = await generateTokens(user, roles);

  const newDecoded = jwt.decode(tokens.refreshToken);
  const newTokenHash = hashToken(tokens.refreshToken);

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: {
      token: newTokenHash,
      expiresAt: new Date(newDecoded.exp * 1000),
      isRevoked: false,
    },
  });

  const safeUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    status: user.status,
    isVerified: user.isVerified,
    role: roles[0] || "tenant",
    roles,
  };

  return {
    user: safeUser,
    tokens,
  };
}

// Logout
export async function logoutUser(rawRefreshToken, userId = null) {
  if (rawRefreshToken) {
    await revokeRefreshTokenByValue(rawRefreshToken);
  }
  if (userId) {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
}

// Verify OTP
export async function verifyOtpService(
  { email, otp, type = "EMAIL_VERIFICATION" },
  t,
) {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  if (!user) {
    throw new AppError(t("common.userNotFound"), 404);
  }

  if (user.status === "SUSPENDED") {
    throw new AppError(t("common.accountSuspended"), 403);
  }

  if (user.status === "INACTIVE") {
    throw new AppError(t("login.inactive"), 403);
  }

  if (user.isVerified) {
    throw new AppError(t("common.alreadyVerified"), 400);
  }

  const otpRecord = await findLatestOtp(user.id, type);

  if (!otpRecord) {
    throw new AppError(t("otp.notFound"), 400);
  }

  if (new Date() > otpRecord.expiresAt) {
    await prisma.otpCode.delete({ where: { id: otpRecord.id } });
    throw new AppError(t("otp.expired"), 400);
  }

  const isMatch = await bcrypt.compare(otp, otpRecord.code);

  if (!isMatch) {
    throw new AppError(t("otp.invalid"), 400);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, status: "ACTIVE" },
    }),
    prisma.otpCode.delete({ where: { id: otpRecord.id } }),
  ]);

  // Send success email asynchronously in the background so it doesn't block the response
  EmailService.sendOtpSuccessEmail({
    to: email,
    subject: "Verification Successful",
  }).catch((err) => {
    logger.error(
      { err: err.message, email },
      "Failed to send OTP success email in background",
    );
  });
}

// Resend OTP
export async function resendOtpService(
  { email, type = "EMAIL_VERIFICATION" },
  t,
) {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  if (!user) {
    throw new AppError(t("common.userNotFound"), 404);
  }

  if (user.isVerified) {
    throw new AppError(t("common.alreadyVerified"), 400);
  }

  await createAndSendOtp({
    userId: user.id,
    email,
    type,
    subject: "New OTP Verification Code",
    invalidatePrevious: true,
  });
}

// Forget Password
// Forget Password
export async function forgetPasswordService({ email }, t) {
  if (!email) {
    throw new AppError(t("resetPassword.emailRequired"), 400);
  }

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
  });

  if (!user) {
    throw new AppError(t("common.userNotFound"), 404);
  }

  if (!user.isVerified) {
    throw new AppError(t("common.accountNotVerified"), 403);
  }

  await invalidatePreviousOtps(user.id, "RESET_PASSWORD");

  // تأكد أن generateResetToken ترجع hex مثل: crypto.randomBytes(32).toString('hex')
  const resetToken = generateResetToken();
  const hashedToken = await bcrypt.hash(resetToken, 10);

  await prisma.otpCode.create({
    data: {
      userId: user.id,
      code: hashedToken,
      type: "RESET_PASSWORD",
      expiresAt: new Date(
        Date.now() + RESET_PASSWORD_EXPIRY_MINUTES * 60 * 1000,
      ),
    },
  });

  // الرابط بعد التصحيح (في سطر واحد ونظيف)
  const baseUrl =
    process.env.FRONTEND_URL || "https://dary-student-housing.vercel.app";
  const resetLink = `${baseUrl}/reset-password/${user.id}/${resetToken}`;

  await EmailService.sendResetPasswordEmail(email, resetLink);

  return {
    message: t("resetPassword.emailSent"),
    resetLink, // احذفه في بيئة الإنتاج Production
  };
}

// Reset Password
export async function resetPasswordService(
  { userId, resetToken, newPassword },
  t,
) {
  if (!userId || !resetToken || !newPassword) {
    throw new AppError(t("resetPassword.missingFields"), 400);
  }

  // إذا كان الـ id في Prisma من نوع Int، حوله لرقم؛ إذا كان UUID/String اتركه كما هو
  const parsedUserId =
    !isNaN(userId) && typeof userId === "string" && !userId.includes("-")
      ? Number(userId)
      : userId;

  const user = await prisma.user.findFirst({
    where: { id: parsedUserId, deletedAt: null },
  });

  if (!user) {
    throw new AppError(t("common.userNotFound"), 404);
  }

  const otpRecord = await findLatestOtp(user.id, "RESET_PASSWORD");

  if (!otpRecord) {
    throw new AppError(t("resetPassword.notFound"), 400);
  }

  if (new Date() > otpRecord.expiresAt) {
    await prisma.otpCode.delete({ where: { id: otpRecord.id } });
    throw new AppError(t("resetPassword.expired"), 400);
  }

  const isMatch = await bcrypt.compare(resetToken.trim(), otpRecord.code);

  if (!isMatch) {
    throw new AppError(t("resetPassword.invalidToken"), 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    }),
    prisma.otpCode.delete({ where: { id: otpRecord.id } }),
    prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    }),
  ]);

  return { success: true, message: t("resetPassword.success") };
}

// Get all users
export async function getAllUsers(t) {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
      profile: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!users || users.length === 0) {
    throw new AppError(t("users.notFound"), 404);
  }

  return users.map((u) => {
    const roles = (u.userRoles || [])
      .map((ur) => ur.role?.name)
      .filter(Boolean);
    const primaryRole = roles.includes("super_admin")
      ? "super_admin"
      : roles.includes("admin")
        ? "admin"
        : roles.includes("owner")
          ? "owner"
          : roles.includes("tenant")
            ? "tenant"
            : roles[0] || "tenant";

    const safe = toSafeUser(u);
    return {
      ...safe,
      role: primaryRole,
      roles,
    };
  });
}

export async function updateUserStatusService(userId, status, t) {
  const normStatus = (status || "").toUpperCase();
  const allowedStatuses = ["ACTIVE", "INACTIVE", "PENDING", "SUSPENDED"];

  if (!allowedStatuses.includes(normStatus)) {
    throw new AppError("Invalid user status", 400);
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
  });
  if (!user) {
    throw new AppError(t("common.userNotFound"), 404);
  }

  if (user.status === normStatus) {
    throw new AppError(
      normStatus === "ACTIVE"
        ? t("common.alreadyActive")
        : t("common.alreadyInactive"),
      400,
    );
  }

  if (normStatus === "INACTIVE" || normStatus === "SUSPENDED") {
    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          status: normStatus,
        },
      }),
      prisma.refreshToken.deleteMany({
        where: {
          userId,
        },
      }),
    ]);
  } else {
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        status: normStatus,
      },
    });
  }

  setMemoryCache(
    `user:status:${userId}`,
    { id: userId, status: normStatus },
    60,
  );

  return {
    userId,
    status: normStatus,
  };
}

// soft delete account
export async function deleteUserService(userId, t) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (!user) {
    throw new AppError(t("common.userNotFound"), 404);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    }),
    prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    }),
  ]);

  setMemoryCache(`user:status:${userId}`, null, 1);
}

// Google Login
export async function googleLoginService(
  { firstName, lastName, email, googleId, avatar },
  t,
) {
  const googleAccount = await prisma.googleAccount.findUnique({
    where: { googleId },
    include: { user: true },
  });

  if (googleAccount) {
    const user = googleAccount.user;

    if (user.status === "SUSPENDED") {
      throw new AppError(t("common.accountSuspended"), 403);
    }

    if (user.status === "INACTIVE") {
      throw new AppError(t("login.inactive"), 403);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
      },
    });

    const tokens = await generateTokens(updatedUser);

    await persistRefreshToken(updatedUser.id, tokens.refreshToken);

    return {
      user: {
        ...toSafeUser(updatedUser),
        role: tokens.roles?.[0] || "tenant",
        roles: tokens.roles || ["tenant"],
      },
      tokens,
    };
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
    },
  });

  if (existingUser) {
    if (existingUser.status === "SUSPENDED") {
      throw new AppError(t("common.accountSuspended"), 403);
    }

    if (existingUser.status === "INACTIVE") {
      throw new AppError(t("login.inactive"), 403);
    }

    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        isVerified: true,

        status:
          existingUser.status === "PENDING" ? "ACTIVE" : existingUser.status,

        avatar: existingUser.avatar || avatar,

        googleAccount: {
          create: {
            googleId,
            email,
          },
        },

        lastLogin: new Date(),
      },
      include: {
        googleAccount: true,
      },
    });
    const tokens = await generateTokens(updatedUser);

    await persistRefreshToken(updatedUser.id, tokens.refreshToken);

    return {
      user: {
        ...toSafeUser(updatedUser),
        role: tokens.roles?.[0] || "tenant",
        roles: tokens.roles || ["tenant"],
      },
      tokens,
    };
  }

  const tenantRole = await prisma.role.findUnique({
    where: {
      name: "tenant",
    },
  });

  if (!tenantRole) {
    throw new AppError("Default tenant role not found", 500);
  }

  const newUser = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      avatar,
      password: "",

      isVerified: true,
      status: "ACTIVE",
      lastLogin: new Date(),

      googleAccount: {
        create: {
          googleId,
          email,
        },
      },

      userRoles: {
        create: {
          roleId: tenantRole.id,
        },
      },
    },

    include: {
      googleAccount: true,

      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  const tokens = await generateTokens(newUser);

  await persistRefreshToken(newUser.id, tokens.refreshToken);

  return {
    user: {
      ...toSafeUser(newUser),
      role: tokens.roles?.[0] || "tenant",
      roles: tokens.roles || ["tenant"],
    },
    tokens,
  };
}
// http://localhost:8003/api/v1/auth/google

// Create Admin directly (Active & Verified without OTP)
export async function createAdminService({
  firstName,
  lastName,
  email,
  phone,
  password,
}) {
  const cleanEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findFirst({
    where: { email: cleanEmail },
  });
  if (existingUser) {
    throw new AppError("البريد الإلكتروني مسجل بالفعل لمستخدم آخر.", 409);
  }
  const cleanPhone = phone && phone.trim() ? phone.trim() : null;
  if (cleanPhone) {
    const existingPhone = await prisma.user.findFirst({
      where: { phone: cleanPhone },
    });
    if (existingPhone) {
      throw new AppError("رقم الهاتف مسجل بالفعل لمستخدم آخر.", 409);
    }
  }

  let adminRole = await prisma.role.findUnique({
    where: { name: "admin" },
  });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        name: "admin",
        description: "System Administrator",
      },
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: (lastName || "Admin").trim(),
        email: cleanEmail,
        phone: cleanPhone,
        password: hashedPassword,
        status: "ACTIVE",
        isVerified: true,
      },
    });

    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRole.id,
      },
    });

    await tx.profile.create({
      data: {
        userId: user.id,
        bio: "مشرف نظام في منصة داري",
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      role: "admin",
      roles: ["admin"],
    };
  });
}
