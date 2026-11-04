import { z } from "zod";

const propertyTypeEnum = z.enum(
  [
    "shared_apartment",
    "private_room",
    "shared_room",
    "studio",
    "entire_apartment",
  ],
  {
    errorMap: () => ({
      message: "propertyType must be a valid property type",
    }),
  },
);

const propertyClassEnum = z.enum(["STANDARD", "LUXURY"], {
  errorMap: () => ({
    message: "propertyClass must be a valid property class",
  }),
});

const targetTenantTypeEnum = z.enum(["STUDENT", "GENERAL", "ANY"], {
  errorMap: () => ({
    message: "targetTenantType must be a valid tenant type",
  }),
});

const genderAllowedEnum = z.enum(["male_only", "female_only"], {
  errorMap: () => ({
    message: "genderAllowed must be a valid gender option",
  }),
});

const reviewStatusEnum = z.enum(["APPROVED", "REJECTED"], {
  errorMap: () => ({
    message: "status must be either APPROVED or REJECTED",
  }),
});

const roomTypeEnum = z.enum(["SINGLE", "DOUBLE", "TRIPLE", "QUAD"], {
  errorMap: () => ({
    message: "roomType must be a valid room type",
  }),
});

const roomStatusEnum = z.enum(["AVAILABLE", "FULL", "HIDDEN"], {
  errorMap: () => ({
    message: "status must be a valid room status",
  }),
});

const imageCategoryEnum = z.enum(
  ["kitchen", "bathroom", "living_room", "exterior", "general"],
  {
    errorMap: () => ({
      message: "category must be a valid image category",
    }),
  },
);

const roomConfigSchema = z
  .object({
    roomType: roomTypeEnum,

    pricePerBed: z.coerce
      .number({ invalid_type_error: "pricePerBed must be a number" })
      .positive("pricePerBed must be greater than 0"),

    totalBeds: z.coerce
      .number({ invalid_type_error: "totalBeds must be a number" })
      .int("totalBeds must be an integer")
      .positive("totalBeds must be greater than 0"),

    availableBeds: z.coerce
      .number({ invalid_type_error: "availableBeds must be a number" })
      .int("availableBeds must be an integer")
      .nonnegative("availableBeds cannot be negative"),

    status: roomStatusEnum.optional(),
  })
  .refine((room) => room.availableBeds <= room.totalBeds, {
    message: "availableBeds cannot exceed totalBeds",
    path: ["availableBeds"],
  });

const amenitySchema = z
  .string()
  .trim()
  .min(1, "amenity cannot be empty")
  .max(100, "amenity must be at most 100 characters");

export const createPropertySchema = z
  .object({
    title: z
      .string({ required_error: "title is required" })
      .trim()
      .min(3, "title must be at least 3 characters")
      .max(150, "title must be at most 150 characters"),

    description: z
      .string()
      .trim()
      .max(3000, "description must be at most 3000 characters")
      .optional(),

    governorate: z
      .string()
      .trim()
      .min(2, "governorate must be at least 2 characters")
      .max(100, "governorate must be at most 100 characters")
      .optional(),

    city: z
      .string()
      .trim()
      .min(2, "city must be at least 2 characters")
      .max(100, "city must be at most 100 characters")
      .optional(),

    district: z
      .string()
      .trim()
      .min(2, "district must be at least 2 characters")
      .max(100, "district must be at most 100 characters")
      .optional(),

    address: z
      .string()
      .trim()
      .min(5, "address must be at least 5 characters")
      .max(255, "address must be at most 255 characters")
      .optional(),

    latitude: z
      .number({ invalid_type_error: "latitude must be a number" })
      .min(-90, "latitude must be between -90 and 90")
      .max(90, "latitude must be between -90 and 90")
      .optional(),

    longitude: z
      .number({ invalid_type_error: "longitude must be a number" })
      .min(-180, "longitude must be between -180 and 180")
      .max(180, "longitude must be between -180 and 180")
      .optional(),

    nearestUniversity: z
      .string()
      .trim()
      .min(2, "nearestUniversity must be at least 2 characters")
      .max(150, "nearestUniversity must be at most 150 characters")
      .optional(),

    distanceToUniversity: z
      .number({
        invalid_type_error: "distanceToUniversity must be a number",
      })
      .nonnegative("distanceToUniversity cannot be negative")
      .optional(),

    propertyType: propertyTypeEnum,

    propertyClass: propertyClassEnum.optional(),

    targetTenantType: targetTenantTypeEnum.optional(),

    genderAllowed: genderAllowedEnum,

    startingPrice: z
      .number({ invalid_type_error: "startingPrice must be a number" })
      .positive("startingPrice must be greater than 0")
      .optional(),

    isFurnished: z.boolean().optional(),

    electricityIncluded: z.boolean().optional(),

    waterIncluded: z.boolean().optional(),

    internetIncluded: z.boolean().optional(),

    amenities: z
      .array(amenitySchema)
      .max(30, "amenities list is too long")
      .optional(),

    roomsConfig: z
      .array(roomConfigSchema)
      .min(1, "at least one room configuration is required"),
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

export const updatePropertySchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "title must be at least 3 characters")
    .max(150, "title must be at most 150 characters")
    .optional(),

  description: z
    .string()
    .trim()
    .max(3000, "description must be at most 3000 characters")
    .optional(),

  governorate: z
    .string()
    .trim()
    .min(2, "governorate must be at least 2 characters")
    .max(100, "governorate must be at most 100 characters")
    .optional(),

  city: z
    .string()
    .trim()
    .min(2, "city must be at least 2 characters")
    .max(100, "city must be at most 100 characters")
    .optional(),

  district: z
    .string()
    .trim()
    .min(2, "district must be at least 2 characters")
    .max(100, "district must be at most 100 characters")
    .optional(),

  address: z
    .string()
    .trim()
    .min(5, "address must be at least 5 characters")
    .max(255, "address must be at most 255 characters")
    .optional(),

  latitude: z
    .number({ invalid_type_error: "latitude must be a number" })
    .min(-90, "latitude must be between -90 and 90")
    .max(90, "latitude must be between -90 and 90")
    .optional(),

  longitude: z
    .number({ invalid_type_error: "longitude must be a number" })
    .min(-180, "longitude must be between -180 and 180")
    .max(180, "longitude must be between -180 and 180")
    .optional(),

  nearestUniversity: z
    .string()
    .trim()
    .min(2, "nearestUniversity must be at least 2 characters")
    .max(150, "nearestUniversity must be at most 150 characters")
    .optional(),

  distanceToUniversity: z
    .number({
      invalid_type_error: "distanceToUniversity must be a number",
    })
    .nonnegative("distanceToUniversity cannot be negative")
    .optional(),

  propertyType: propertyTypeEnum.optional(),

  propertyClass: propertyClassEnum.optional(),

  targetTenantType: targetTenantTypeEnum.optional(),

  genderAllowed: genderAllowedEnum.optional(),

  startingPrice: z
    .number({ invalid_type_error: "startingPrice must be a number" })
    .positive("startingPrice must be greater than 0")
    .optional(),

  isFurnished: z.boolean().optional(),

  electricityIncluded: z.boolean().optional(),

  waterIncluded: z.boolean().optional(),

  internetIncluded: z.boolean().optional(),

  amenities: z
    .array(amenitySchema)
    .max(30, "amenities list is too long")
    .optional(),
});

export const reviewPropertySchema = z
  .object({
    status: reviewStatusEnum,

    rejectionReason: z
      .string()
      .trim()
      .min(3, "rejectionReason must be at least 3 characters")
      .max(500, "rejectionReason must be at most 500 characters")
      .optional(),
  })
  .refine((data) => data.status !== "REJECTED" || !!data.rejectionReason, {
    message: "rejectionReason is required when status is REJECTED",
    path: ["rejectionReason"],
  });

export const addRoomSchema = roomConfigSchema;

export const updateRoomSchema = z
  .object({
    roomType: roomTypeEnum.optional(),

    pricePerBed: z.coerce
      .number({ invalid_type_error: "pricePerBed must be a number" })
      .positive("pricePerBed must be greater than 0")
      .optional(),

    totalBeds: z.coerce
      .number({ invalid_type_error: "totalBeds must be a number" })
      .int("totalBeds must be an integer")
      .positive("totalBeds must be greater than 0")
      .optional(),

    availableBeds: z.coerce
      .number({ invalid_type_error: "availableBeds must be a number" })
      .int("availableBeds must be an integer")
      .nonnegative("availableBeds cannot be negative")
      .optional(),

    status: roomStatusEnum.optional(),
  })
  .refine(
    (data) =>
      data.totalBeds === undefined ||
      data.availableBeds === undefined ||
      data.availableBeds <= data.totalBeds,
    {
      message: "availableBeds cannot exceed totalBeds",
      path: ["availableBeds"],
    },
  );

export const uploadImagesSchema = z.object({
  category: imageCategoryEnum.optional(),
});

export const reorderImagesSchema = z.object({
  order: z
    .array(z.string().uuid("each image id must be a valid uuid"))
    .min(1, "order list cannot be empty"),
});
