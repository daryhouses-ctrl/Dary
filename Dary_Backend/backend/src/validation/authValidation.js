import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

const phoneSchema = z
  .string({ required_error: "phone is required" })
  .trim()
  .transform((val) => val.replace(/[\s\-\(\)\.]+/g, ""))
  .refine((value) => {
    if (!value) return false;
    let normalized = value.startsWith("00") ? `+${value.slice(2)}` : value;
    if (normalized.startsWith("+200")) {
      normalized = "+20" + normalized.slice(4);
    }
    const phoneNumber = normalized.startsWith("+")
      ? parsePhoneNumberFromString(normalized)
      : parsePhoneNumberFromString(normalized, "EG");

    return phoneNumber?.isValid() ?? false;
  }, "phone must be a valid phone number")
  .transform((value) => {
    let normalized = value.startsWith("00") ? `+${value.slice(2)}` : value;
    if (normalized.startsWith("+200")) {
      normalized = "+20" + normalized.slice(4);
    }
    const phoneNumber = normalized.startsWith("+")
      ? parsePhoneNumberFromString(normalized)
      : parsePhoneNumberFromString(normalized, "EG");

    return phoneNumber?.number || normalized;
  });

const passwordSchema = z
  .string({ required_error: "password is required" })
  .min(8, "password must be at least 8 characters")
  .max(72, "password must be at most 72 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/,
    "password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  );

const otpTypeEnum = z.enum(
  ["EMAIL_VERIFICATION", "PHONE_VERIFICATION", "RESET_PASSWORD"],
  {
    errorMap: () => ({
      message: "type must be a valid OTP type",
    }),
  },
);

export const registerSchema = z
  .object({
    firstName: z
      .string({ required_error: "firstName is required" })
      .trim()
      .min(2, "firstName must be at least 2 characters")
      .max(50, "firstName must be at most 50 characters"),

    lastName: z
      .string({ required_error: "lastName is required" })
      .trim()
      .min(2, "lastName must be at least 2 characters")
      .max(50, "lastName must be at most 50 characters"),

    email: z
      .union([
        z
          .string()
          .trim()
          .toLowerCase()
          .email("email must be a valid email address")
          .max(255, "email must be at most 255 characters"),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((val) => val || null),

    password: passwordSchema,
    phone: phoneSchema,
    whatsappPhone: z
      .union([phoneSchema, z.literal(""), z.null()])
      .optional()
      .transform((val) => val || null),
    roles: z.string().trim().optional(),
    roleName: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const role = data.roleName || data.roles;
    if (!role) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roles"],
        message: "role is required",
      });
    }
    if (role !== "owner" && !data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "email is required for this role",
      });
    }
  })
  .transform((data) => ({
    ...data,
    role: data.roleName || data.roles,
  }));

export const loginSchema = z
  .object({
    email: z.string().trim().optional(),
    phone: z
      .string()
      .trim()
      .transform((val) => val.replace(/[\s\-\(\)\.]+/g, ""))
      .optional(),
    password: z
      .string({ required_error: "password is required" })
      .min(1, "password is required"),
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: "email or phone is required",
    path: ["email"],
  });

export const verifyOtpSchema = z.object({
  email: z
    .string({ required_error: "email is required" })
    .trim()
    .toLowerCase()
    .email("email must be a valid email address")
    .max(255, "email must be at most 255 characters"),

  otp: z
    .string({ required_error: "otp is required" })
    .trim()
    .length(6, "otp must be exactly 6 digits")
    .regex(/^[0-9]+$/, "otp must contain digits only"),

  type: otpTypeEnum.optional(),
});

export const resendOtpSchema = z.object({
  email: z
    .string({ required_error: "email is required" })
    .trim()
    .toLowerCase()
    .email("email must be a valid email address")
    .max(255, "email must be at most 255 characters"),

  type: otpTypeEnum.optional(),
});

export const forgetPasswordSchema = z.object({
  email: z
    .string({ required_error: "email is required" })
    .trim()
    .toLowerCase()
    .email("email must be a valid email address")
    .max(255, "email must be at most 255 characters"),
});

export const resetPasswordSchema = z.object({
  userId: z
    .string({ required_error: "userId is required" })
    .uuid("userId must be a valid uuid"),

  resetToken: z
    .string({ required_error: "resetToken is required" })
    .trim()
    .min(10, "resetToken is invalid"),

  newPassword: passwordSchema,
});
