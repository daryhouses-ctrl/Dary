import { z } from "zod";

const genderEnum = z.enum(["MALE", "FEMALE"], {
  errorMap: () => ({
    message: "gender must be either MALE or FEMALE",
  }),
});

export const upsertProfileSchema = z
  .object({
    gender: genderEnum.optional(),

    birthDate: z
      .string()
      .trim()
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);

        return (
          /^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(date.getTime()) &&
          date.toISOString().slice(0, 10) === value
        );
      }, "birthDate must be a valid date in YYYY-MM-DD format")
      .optional(),

    nationality: z
      .string()
      .trim()
      .min(2, "nationality must be at least 2 characters")
      .max(100)
      .optional(),

    university: z
      .string()
      .trim()
      .min(2, "university must be at least 2 characters")
      .max(150)
      .optional(),

    faculty: z
      .string()
      .trim()
      .min(2, "faculty must be at least 2 characters")
      .max(150)
      .optional(),

    country: z
      .string()
      .trim()
      .min(2, "country must be at least 2 characters")
      .max(100)
      .optional(),

    city: z
      .string()
      .trim()
      .min(2, "city must be at least 2 characters")
      .max(100)
      .optional(),

    address: z
      .string()
      .trim()
      .min(5, "address must be at least 5 characters")
      .max(255)
      .optional(),

    latitude: z
      .number()
      .min(-90, "latitude must be between -90 and 90")
      .max(90, "latitude must be between -90 and 90")
      .optional(),

    longitude: z
      .number()
      .min(-180, "longitude must be between -180 and 180")
      .max(180, "longitude must be between -180 and 180")
      .optional(),

    bio: z
      .string()
      .trim()
      .max(1000, "bio must not exceed 1000 characters")
      .optional(),
  })
  .refine(
    (data) =>
      (data.latitude === undefined && data.longitude === undefined) ||
      (data.latitude !== undefined && data.longitude !== undefined),
    {
      message: "latitude and longitude must be provided together",
      path: ["latitude"],
    },
  );
