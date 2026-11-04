import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";
import {
  cloudinaryUploadImage,
  cloudinaryRemove,
} from "../core/cloudinary/Cloudinary.js";

const VALID_CATEGORIES = [
  "kitchen",
  "bathroom",
  "living_room",
  "exterior",
  "general",
];

async function assertPropertyOwnership(propertyId, ownerId, t, isAdmin = false) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, deletedAt: null },
  });

  if (!property) {
    throw new AppError(t("property.notFound"), 404);
  }

  if (!isAdmin && property.ownerId !== ownerId) {
    throw new AppError(t("common.forbidden"), 403);
  }

  return property;
}
// Upload Images
export async function uploadPropertyImagesService(
  propertyId,
  ownerId,
  files,
  category,
  t,
  isAdmin = false,
) {
  if (!files || files.length === 0) {
    throw new AppError(t("property.imagesRequired"), 400);
  }

  if (category && !VALID_CATEGORIES.includes(category)) {
    throw new AppError(t("property.invalidCategory"), 400);
  }

  await assertPropertyOwnership(propertyId, ownerId, t, isAdmin);

  const existingCount = await prisma.propertyImage.count({
    where: { propertyId },
  });

  const uploadResults = await Promise.all(
    files.map((file) => cloudinaryUploadImage(file.buffer)),
  );

  const isFirstBatch = existingCount === 0;

  const images = await prisma.$transaction(
    uploadResults.map((uploaded, index) =>
      prisma.propertyImage.create({
        data: {
          propertyId,
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          category: category || "general",
          isPrimary: isFirstBatch && index === 0,
          order: existingCount + index,
        },
      }),
    ),
  );

  return images;
}
// Get Property Images
export async function getPropertyImagesService(propertyId, t) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, deletedAt: null },
  });

  if (!property) {
    throw new AppError(t("property.notFound"), 404);
  }

  return prisma.propertyImage.findMany({
    where: { propertyId },
    orderBy: { order: "asc" },
  });
}
// Delete Image
export async function deletePropertyImageService(
  imageId,
  ownerId,
  t,
  isAdmin = false,
) {
  const image = await prisma.propertyImage.findUnique({
    where: { id: imageId },
    include: { property: true },
  });

  if (!image) {
    throw new AppError(t("property.imageNotFound"), 404);
  }

  if (!isAdmin && image.property.ownerId !== ownerId) {
    throw new AppError(t("common.forbidden"), 403);
  }

  if (image.publicId) {
    await cloudinaryRemove(image.publicId);
  }

  await prisma.propertyImage.delete({ where: { id: imageId } });

  if (image.isPrimary) {
    const nextImage = await prisma.propertyImage.findFirst({
      where: { propertyId: image.propertyId },
      orderBy: { order: "asc" },
    });

    if (nextImage) {
      await prisma.propertyImage.update({
        where: { id: nextImage.id },
        data: { isPrimary: true },
      });
    }
  }
}
// Set Primary Image يعني اخليها تظهر اول صوره
export async function setPrimaryImageService(
  imageId,
  ownerId,
  t,
  isAdmin = false,
) {
  const image = await prisma.propertyImage.findUnique({
    where: { id: imageId },
    include: { property: true },
  });

  if (!image) {
    throw new AppError(t("property.imageNotFound"), 404);
  }

  if (!isAdmin && image.property.ownerId !== ownerId) {
    throw new AppError(t("common.forbidden"), 403);
  }

  if (image.isPrimary) {
    return image;
  }

  await prisma.$transaction([
    prisma.propertyImage.updateMany({
      where: { propertyId: image.propertyId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.propertyImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    }),
  ]);

  return prisma.propertyImage.findUnique({ where: { id: imageId } });
}
// Reorder Images to display
export async function reorderPropertyImagesService(
  propertyId,
  ownerId,
  orderedIds,
  t,
  isAdmin = false,
) {
  await assertPropertyOwnership(propertyId, ownerId, t, isAdmin);

  const images = await prisma.propertyImage.findMany({
    where: { propertyId },
    select: { id: true },
  });

  const validIds = new Set(images.map((img) => img.id));
  const allValid = orderedIds.every((id) => validIds.has(id));

  if (!allValid || orderedIds.length !== images.length) {
    throw new AppError(t("property.invalidImageOrder"), 400);
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.propertyImage.update({ where: { id }, data: { order: index } }),
    ),
  );

  return prisma.propertyImage.findMany({
    where: { propertyId },
    orderBy: { order: "asc" },
  });
}
