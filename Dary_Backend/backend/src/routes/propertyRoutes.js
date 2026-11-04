import { Router } from "express";
import authMiddleware, { optionalAuthMiddleware } from "../core/middleware/authMiddleware.js";
import { requirePermission } from "../core/middleware/permissionMiddleware.js";
import { uploadImage } from "../core/middleware/Upload/uploadMiddleware.js";
import { parseJsonFields } from "../core/middleware/parseJsonFields.js";
import { parsePropertyFields } from "../core/middleware/parsePropertyFields.js";
import validate from "../core/middleware/ValidateMiddleware.js";
import { validateUUID } from "../core/middleware/ValidateId.js";

import {
  createProperty,
  getProperties,
  getPropertyById,
  getMyProperties,
  updateProperty,
  deleteProperty,
  toggleAvailability,
  getPendingProperties,
  reviewProperty,
  suspendProperty,
} from "../controllers/propertyController.js";

import {
  addPropertyRoom,
  updatePropertyRoom,
  uploadRoomPhoto,
  deletePropertyRoom,
} from "../controllers/propertyRoomController.js";

import {
  uploadPropertyImages,
  getPropertyImages,
  deletePropertyImage,
  setPrimaryImage,
  reorderPropertyImages,
} from "../controllers/propertyImageController.js";

import {
  createPropertySchema,
  updatePropertySchema,
  reviewPropertySchema,
  addRoomSchema,
  updateRoomSchema,
  uploadImagesSchema,
  reorderImagesSchema,
} from "../validation/propertyValidation.js";

import { validatePropertyFiles } from "../core/middleware/Upload/validatePropertyFiles.js";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requirePermission("property.create"),
  uploadImage.fields([
    {
      name: "roomPhotos",
      maxCount: 10,
    },
    {
      name: "kitchenPhotos",
      maxCount: 10,
    },
    {
      name: "bathroomPhotos",
      maxCount: 10,
    },
    {
      name: "livingRoomPhotos",
      maxCount: 10,
    },
  ]),
  parseJsonFields(["roomsConfig", "amenities"]),
  parsePropertyFields,
  validate(createPropertySchema),
  validatePropertyFiles,
  createProperty,
);

router.get(
  "/my",
  authMiddleware,
  requirePermission("property.read_own"),
  getMyProperties,
);

router.get(
  "/pending",
  authMiddleware,
  requirePermission("property.pending.read"),
  getPendingProperties,
);

router.get("/", getProperties);

router.get("/:id", optionalAuthMiddleware, validateUUID, getPropertyById);

router.put(
  "/:id",
  authMiddleware,
  requirePermission("property.update"),
  validateUUID,
  validate(updatePropertySchema),
  updateProperty,
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission("property.delete"),
  validateUUID,
  deleteProperty,
);

router.patch(
  "/:id/availability",
  authMiddleware,
  requirePermission("property.availability.toggle"),
  validateUUID,
  toggleAvailability,
);

router.patch(
  "/:id/review",
  authMiddleware,
  requirePermission("property.review"),
  validateUUID,
  validate(reviewPropertySchema),
  reviewProperty,
);

router.patch(
  "/:id/suspend",
  authMiddleware,
  requirePermission("property.suspend"),
  validateUUID,
  suspendProperty,
);

router.post(
  "/:propertyId/rooms",
  authMiddleware,
  requirePermission("property.room.create"),
  validateUUID,
  uploadImage.single("photo"),
  validate(addRoomSchema),
  addPropertyRoom,
);

router.patch(
  "/rooms/:roomId",
  authMiddleware,
  requirePermission("property.room.update"),
  validateUUID,
  validate(updateRoomSchema),
  updatePropertyRoom,
);

router.patch(
  "/rooms/:roomId/photo",
  authMiddleware,
  requirePermission("property.room.photo.update"),
  validateUUID,
  uploadImage.single("photo"),
  uploadRoomPhoto,
);

router.delete(
  "/rooms/:roomId",
  authMiddleware,
  requirePermission("property.room.delete"),
  validateUUID,
  deletePropertyRoom,
);

router.post(
  "/:propertyId/images",
  authMiddleware,
  requirePermission("property.image.upload"),
  validateUUID,
  uploadImage.array("images", 10),
  validate(uploadImagesSchema),
  uploadPropertyImages,
);

router.get("/:propertyId/images", validateUUID, getPropertyImages);

router.delete(
  "/images/:imageId",
  authMiddleware,
  requirePermission("property.image.delete"),
  validateUUID,
  deletePropertyImage,
);

router.patch(
  "/images/:imageId/primary",
  authMiddleware,
  requirePermission("property.image.primary"),
  validateUUID,
  setPrimaryImage,
);

router.patch(
  "/:propertyId/images/reorder",
  authMiddleware,
  requirePermission("property.image.reorder"),
  validateUUID,
  validate(reorderImagesSchema),
  reorderPropertyImages,
);


export default router;
