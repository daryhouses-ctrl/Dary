import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";
import {
  cloudinaryUploadImage,
  cloudinaryRemove,
} from "../core/cloudinary/Cloudinary.js";

//  Verify   property exists and belongs to the owner (or admin)
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

//  Keep property room count in sync with the actual PropertyRoom records
async function syncRoomsCount(propertyId) {
  const count = await prisma.propertyRoom.count({ where: { propertyId } });

  await prisma.property.update({
    where: { id: propertyId },
    data: { rooms: count },
  });
}

// Add Room
export async function addPropertyRoomService(
  propertyId,
  ownerId,
  data,
  file,
  t,
  isAdmin = false,
) {
  await assertPropertyOwnership(propertyId, ownerId, t, isAdmin);
  if (data.availableBeds > data.totalBeds) {
    throw new AppError(t("property.invalidBedsCount"), 400);
  }

  let photoUrl = null;
  let photoPublicId = null;

  if (file) {
    const uploaded = await cloudinaryUploadImage(file.buffer);
    photoUrl = uploaded.secure_url;
    photoPublicId = uploaded.public_id;
  }

  const room = await prisma.propertyRoom.create({
    data: {
      propertyId,
      roomType: data.roomType,
      pricePerBed: data.pricePerBed,
      totalBeds: data.totalBeds,
      availableBeds: data.availableBeds,
      status: data.status || "AVAILABLE",
      photoUrl,
      photoPublicId,
    },
  });

  await syncRoomsCount(propertyId);

  return room;
}

// Update Room
export async function updatePropertyRoomService(
  roomId,
  ownerId,
  data,
  t,
  isAdmin = false,
) {
  const room = await prisma.propertyRoom.findUnique({
    where: { id: roomId },
    include: { property: true },
  });

  if (!room) {
    throw new AppError(t("property.roomNotFound"), 404);
  }

  if (!isAdmin && room.property.ownerId !== ownerId) {
    throw new AppError(t("common.forbidden"), 403);
  }
  const totalBeds = data.totalBeds ?? room.totalBeds;
  const availableBeds = data.availableBeds ?? room.availableBeds;

  if (availableBeds > totalBeds) {
    throw new AppError(t("property.invalidBedsCount"), 400);
  }

  return prisma.propertyRoom.update({
    where: { id: roomId },
    data,
  });
}

// Upload / Replace Room Photo
export async function uploadRoomPhotoService(
  roomId,
  ownerId,
  file,
  t,
  isAdmin = false,
) {
  const room = await prisma.propertyRoom.findUnique({
    where: { id: roomId },
    include: { property: true },
  });

  if (!room) {
    throw new AppError(t("property.roomNotFound"), 404);
  }

  if (!isAdmin && room.property.ownerId !== ownerId) {
    throw new AppError(t("common.forbidden"), 403);
  }

  if (!file) {
    throw new AppError(t("property.roomPhotoRequired"), 400);
  }

  if (room.photoPublicId) {
    await cloudinaryRemove(room.photoPublicId);
  }

  const uploaded = await cloudinaryUploadImage(file.buffer);

  return prisma.propertyRoom.update({
    where: { id: roomId },
    data: {
      photoUrl: uploaded.secure_url,
      photoPublicId: uploaded.public_id,
    },
  });
}

// Delete Room
export async function deletePropertyRoomService(
  roomId,
  ownerId,
  t,
  isAdmin = false,
) {
  const room = await prisma.propertyRoom.findUnique({
    where: { id: roomId },
    include: { property: true },
  });

  if (!room) {
    throw new AppError(t("property.roomNotFound"), 404);
  }

  if (!isAdmin && room.property.ownerId !== ownerId) {
    throw new AppError(t("common.forbidden"), 403);
  }

  if (room.photoPublicId) {
    await cloudinaryRemove(room.photoPublicId);
  }

  await prisma.propertyRoom.delete({ where: { id: roomId } });

  await syncRoomsCount(room.propertyId);
}
