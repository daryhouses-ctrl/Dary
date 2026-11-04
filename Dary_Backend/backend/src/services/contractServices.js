import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";
import cloudinary from "../core/cloudinary/Cloudinary.js";
import { dispatchNotificationService } from "./notificationServices.js";
import { clearDashboardBookingsCache } from "../utils/dashboardCache.js";
import { clearPropertyCache } from "../utils/propertyCache.js";
import { deleteMemoryCache } from "../utils/memoryCache.js";
import { ContractApiFeatures } from "../utils/api-features.js";

async function removeRawFile(publicId) {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
    });
  } catch (error) {
    console.error("Failed to remove old contract PDF:", error.message);
  }
}

// Check contract access permissions (view access)
async function loadContractWithAccess(contractId, userId, isAdmin, t) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      booking: {
        include: {
          property: {
            select: {
              ownerId: true,
              title: true,
              city: true,
              district: true,
            },
          },
          room: true,
          tenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              whatsappPhone: true,
            },
          },
        },
      },
    },
  });

  if (!contract) {
    throw new AppError(t("contract.notFound"), 404);
  }

  const isTenant = contract.booking.tenantId === userId;
  const isOwner = contract.booking.property.ownerId === userId;

  if (!isTenant && !isOwner && !isAdmin) {
    throw new AppError(t("common.forbidden"), 403);
  }

  return { contract, isTenant, isOwner };
}

export async function createContractService(adminId, bookingId, t) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      contract: true,
      property: {
        select: {
          title: true,
          ownerId: true,
        },
      },
      room: true,
    },
  });

  if (!booking) {
    throw new AppError(t("booking.notFound"), 404);
  }

  if (!["CONTACTED", "CONFIRMED"].includes(booking.status)) {
    throw new AppError(t("contract.bookingNotContacted"), 400);
  }

  if (booking.contract) {
    throw new AppError(t("contract.alreadyExists"), 409);
  }

  const contractNumber = `CT-${Date.now()}-${booking.id
    .slice(0, 6)
    .toUpperCase()}`;

  return prisma.contract.create({
    data: {
      bookingId,
      contractNumber,
      status: "DRAFT",
    },
  });
}

export async function sendContractService(contractId, adminId, file, t) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });

  if (!contract) {
    throw new AppError(t("contract.notFound"), 404);
  }

  if (contract.status !== "DRAFT") {
    throw new AppError(t("contract.invalidStatusForAction"), 400);
  }

  if (!file) {
    throw new AppError(t("contract.pdfRequired"), 400);
  }

  return prisma.contract.update({
    where: { id: contractId },
    data: {
      draftPdfUrl: file.secure_url,
      draftPdfPublicId: file.public_id,
      status: "SENT",
    },
  });
}

//  Tenant signs
export async function tenantSignContractService(contractId, tenantId, file, t) {
  const { contract } = await loadContractWithAccess(
    contractId,
    tenantId,
    false,
    t,
  );

  if (contract.booking.tenantId !== tenantId) {
    throw new AppError(t("common.forbidden"), 403);
  }

  if (contract.status !== "SENT") {
    throw new AppError(t("contract.invalidStatusForAction"), 400);
  }

  if (contract.tenantSignedAt) {
    throw new AppError(t("contract.alreadySigned"), 400);
  }

  if (!file) {
    throw new AppError(t("contract.pdfRequired"), 400);
  }
  const bothSigned = Boolean(contract.ownerSignedAt);

  const updatedContract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      tenantSignedPdfUrl: file.secure_url,
      tenantSignedPdfPublicId: file.public_id,
      tenantSignedAt: new Date(),
      status: bothSigned ? "SIGNED" : "SENT",
    },
  });
  try {
    await dispatchNotificationService({
      userId: contract.booking.property.ownerId,
      event: "contract",
      channel: "in_app",
      title: "Tenant Signed Contract",
      body: bothSigned
        ? "The tenant has signed the contract. The contract is now fully signed."
        : "The tenant has signed the contract. Waiting for your signature.",

      payload: {
        contractId: updatedContract.id,
        bookingId: contract.booking.id,
        propertyId: contract.booking.propertyId,
        roomId: contract.booking.roomId,
        tenantId: contract.booking.tenantId,
        action: "tenant_signed",
        contractStatus: updatedContract.status,
        tenantSignedAt: updatedContract.tenantSignedAt,
        ownerSignedAt: updatedContract.ownerSignedAt,
      },
      relatedEntityType: "contract",
      relatedEntityId: updatedContract.id,
    });
  } catch (error) {
    console.error(
      `Failed to send tenant signed notification for contract ${contractId}:`,
      error,
    );
  }

  return updatedContract;
}
// Owner signs
export async function ownerSignContractService(contractId, ownerId, file, t) {
  const { contract } = await loadContractWithAccess(
    contractId,
    ownerId,
    false,
    t,
  );

  if (contract.booking.property.ownerId !== ownerId) {
    throw new AppError(t("common.forbidden"), 403);
  }

  if (contract.status !== "SENT") {
    throw new AppError(t("contract.invalidStatusForAction"), 400);
  }

  if (contract.ownerSignedAt) {
    throw new AppError(t("contract.alreadySigned"), 400);
  }

  if (!file) {
    throw new AppError(t("contract.pdfRequired"), 400);
  }

  const bothSigned = Boolean(contract.tenantSignedAt);

  const updatedContract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      ownerSignedPdfUrl: file.secure_url,
      ownerSignedPdfPublicId: file.public_id,
      ownerSignedAt: new Date(),
      status: bothSigned ? "SIGNED" : "SENT",
    },
  });
  try {
    await dispatchNotificationService({
      userId: contract.booking.tenantId,
      event: "contract",
      channel: "in_app",
      title: "Owner Signed Contract",
      body: bothSigned
        ? "The owner has signed the contract. The contract is now fully signed."
        : "The owner has signed the contract. Waiting for your signature.",
      payload: {
        contractId: updatedContract.id,
        bookingId: contract.booking.id,
        propertyId: contract.booking.propertyId,
        roomId: contract.booking.roomId,
        tenantId: contract.booking.tenantId,
        ownerId,
        action: "owner_signed",
        contractStatus: updatedContract.status,
        tenantSignedAt: updatedContract.tenantSignedAt,
        ownerSignedAt: updatedContract.ownerSignedAt,
      },

      relatedEntityType: "contract",
      relatedEntityId: updatedContract.id,
    });
  } catch (error) {
    console.error(
      `Failed to send owner signed notification for contract ${contractId}:`,
      error,
    );
  }

  return updatedContract;
}

// Admin activates the contract
//    Beds are locked HERE and Booking is moved to CLOSED (Revenue Recognized)
export async function activateContractService(contractId, adminId, t) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      booking: {
        include: {
          room: true,
          property: {
            select: {
              ownerId: true,
              title: true,
            },
          },
        },
      },
    },
  });

  if (!contract) {
    throw new AppError(t("contract.notFound"), 404);
  }

  if (contract.status !== "SIGNED") {
    throw new AppError(t("contract.invalidStatusForAction"), 400);
  }

  const room = contract.booking.room;
  const bedsRequested = contract.booking.bedsRequested;
  const bookingWasClosed = contract.booking.status === "CLOSED";

  // Race condition protection (only deduct if booking wasn't already CLOSED)
  let newAvailableBeds = room.availableBeds;
  if (!bookingWasClosed) {
    if (bedsRequested > room.availableBeds) {
      throw new AppError(t("booking.noBedsAvailable"), 400);
    }
    newAvailableBeds = room.availableBeds - bedsRequested;
  }

  const updatedContract = await prisma.$transaction(async (tx) => {
    if (!bookingWasClosed) {
      await tx.propertyRoom.update({
        where: { id: room.id },
        data: {
          availableBeds: newAvailableBeds,
          status: newAvailableBeds === 0 ? "FULL" : "AVAILABLE",
        },
      });

      await tx.booking.update({
        where: { id: contract.bookingId },
        data: {
          status: "CLOSED",
        },
      });
    }

    return tx.contract.update({
      where: { id: contractId },
      data: {
        status: "ACTIVE",
        reviewedByAdminId: adminId,
      },
    });
  });

  const ownerId = contract.booking.property?.ownerId;
  clearDashboardBookingsCache(ownerId);
  clearPropertyCache();
  deleteMemoryCache(`properties:id:${contract.booking.propertyId}`);
  if (ownerId) {
    deleteMemoryCache(`properties:my:${ownerId}`);
    deleteMemoryCache(`booking:property:${contract.booking.propertyId}:${ownerId}`);
  }
  deleteMemoryCache("properties:all");

  try {
    await dispatchNotificationService({
      userId: contract.booking.tenantId,
      event: "contract",
      channel: "in_app",
      title: "Contract Activated",
      body: "Your contract has been activated successfully.",
      payload: {
        contractId: updatedContract.id,
        bookingId: contract.booking.id,
        propertyId: contract.booking.propertyId,
        roomId: contract.booking.roomId,
        tenantId: contract.booking.tenantId,
        ownerId: contract.booking.property.ownerId,
        action: "activated",
        status: updatedContract.status,
        bedsRequested,
        remainingBeds: newAvailableBeds,
      },
      relatedEntityType: "contract",
      relatedEntityId: updatedContract.id,
    });
  } catch (error) {
    console.error(
      `Failed to notify tenant about contract activation ${contractId}:`,
      error,
    );
  }

  try {
    await dispatchNotificationService({
      userId: contract.booking.property.ownerId,
      event: "contract",
      channel: "in_app",
      title: "Contract Activated",
      body: "The contract has been activated successfully.",

      payload: {
        contractId: updatedContract.id,
        bookingId: contract.booking.id,
        propertyId: contract.booking.propertyId,
        roomId: contract.booking.roomId,
        tenantId: contract.booking.tenantId,
        ownerId: contract.booking.property.ownerId,
        action: "activated",
        status: updatedContract.status,
        bedsRequested,
        remainingBeds: newAvailableBeds,
      },

      relatedEntityType: "contract",
      relatedEntityId: updatedContract.id,
    });
  } catch (error) {
    console.error(
      `Failed to notify owner about contract activation ${contractId}:`,
      error,
    );
  }

  return updatedContract;
}

// Cancel Contract
export async function cancelContractService(contractId, adminId, t) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },

    include: {
      booking: {
        include: {
          room: true,

          property: {
            select: {
              ownerId: true,
              title: true,
            },
          },
        },
      },
    },
  });

  if (!contract) {
    throw new AppError(t("contract.notFound"), 404);
  }

  if (contract.status === "CANCELLED") {
    throw new AppError(t("contract.cannotCancel"), 400);
  }

  const previousStatus = contract.status;

  const bedsWereLocked = contract.status === "ACTIVE";

  let restoredBeds = null;

  const updatedContract = await prisma.$transaction(async (tx) => {
    if (bedsWereLocked) {
      const room = contract.booking.room;

      restoredBeds = Math.min(
        room.totalBeds,
        room.availableBeds + contract.booking.bedsRequested,
      );

      await tx.propertyRoom.update({
        where: { id: room.id },

        data: {
          availableBeds: restoredBeds,
          status: "AVAILABLE",
        },
      });
    }

    return tx.contract.update({
      where: { id: contractId },

      data: {
        status: "CANCELLED",
        reviewedByAdminId: adminId,
      },
    });
  });
  try {
    await dispatchNotificationService({
      userId: contract.booking.tenantId,
      event: "contract",
      channel: "in_app",
      title: "Contract Cancelled",
      body: "Your contract has been cancelled by the administration.",
      payload: {
        contractId: updatedContract.id,
        bookingId: contract.booking.id,
        propertyId: contract.booking.propertyId,
        roomId: contract.booking.roomId,
        tenantId: contract.booking.tenantId,
        ownerId: contract.booking.property.ownerId,
        action: "cancelled",
        previousStatus,
        status: updatedContract.status,
        bedsRequested: contract.booking.bedsRequested,
        restoredBeds,
      },

      relatedEntityType: "contract",
      relatedEntityId: updatedContract.id,
    });
  } catch (error) {
    console.error(
      `Failed to notify tenant about contract cancellation ${contractId}:`,
      error,
    );
  }

  try {
    await dispatchNotificationService({
      userId: contract.booking.property.ownerId,

      event: "contract",

      channel: "in_app",

      title: "Contract Cancelled",

      body: "The contract has been cancelled by the administration.",

      payload: {
        contractId: updatedContract.id,
        bookingId: contract.booking.id,
        propertyId: contract.booking.propertyId,
        roomId: contract.booking.roomId,
        tenantId: contract.booking.tenantId,
        ownerId: contract.booking.property.ownerId,
        action: "cancelled",
        previousStatus,
        status: updatedContract.status,
        bedsRequested: contract.booking.bedsRequested,
        restoredBeds,
      },

      relatedEntityType: "contract",
      relatedEntityId: updatedContract.id,
    });
  } catch (error) {
    console.error(
      `Failed to notify owner about contract cancellation ${contractId}:`,
      error,
    );
  }

  return updatedContract;
}
// Get Contract By Id

export async function getContractByIdService(contractId, userId, isAdmin, t) {
  const { contract } = await loadContractWithAccess(
    contractId,
    userId,
    isAdmin,
    t,
  );

  return contract;
}

// Get Contract By Booking Id

export async function getContractByBookingIdService(
  bookingId,
  userId,
  isAdmin,
  t,
) {
  const contract = await prisma.contract.findUnique({
    where: { bookingId },
    include: {
      booking: {
        include: {
          property: {
            select: {
              ownerId: true,
              title: true,
            },
          },
        },
      },
    },
  });

  if (!contract) {
    throw new AppError(t("contract.notFound"), 404);
  }

  const isTenant = contract.booking.tenantId === userId;
  const isOwner = contract.booking.property.ownerId === userId;

  if (!isTenant && !isOwner && !isAdmin) {
    throw new AppError(t("common.forbidden"), 403);
  }

  return contract;
}

// Get All Contracts (Admin - Filter + Pagination)

export async function getAllContractsService(query, t) {
  const features = new ContractApiFeatures(query).filter().sort().paginate();

  const result = await features.execute(prisma.contract, {
    include: {
      booking: {
        include: {
          property: {
            select: {
              title: true,
              city: true,
            },
          },
          tenant: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  return {
    data: result.data,
    meta: result.meta,
  };
}
