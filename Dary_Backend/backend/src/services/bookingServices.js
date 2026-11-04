import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";
import { dispatchNotificationService } from "./notificationServices.js";
import { BookingCalendarApiFeatures } from "../utils/api-features.js";
import {
  clearDashboardBookingsCache,
  getOrSetDashboardCache,
  generateDashboardKey,
  DASHBOARD_TTL,
} from "../utils/dashboardCache.js";
import {
  getMemoryCache,
  setMemoryCache,
  deleteMemoryCache,
} from "../utils/memoryCache.js";
import { clearPropertyCache } from "../utils/propertyCache.js";

const SUPER_ADMIN_WHATSAPP = process.env.SUPER_ADMIN_WHATSAPP;

function calculateMonthsCount(startDate, endDate) {
  const yearsDiff = endDate.getFullYear() - startDate.getFullYear();
  const monthsDiff = endDate.getMonth() - startDate.getMonth();
  const daysDiff = endDate.getDate() - startDate.getDate();

  let totalMonths = yearsDiff * 12 + monthsDiff;

  if (daysDiff > 0) {
    totalMonths += 1;
  }

  return totalMonths < 1 ? 1 : totalMonths;
}

function buildWhatsappLink(booking, tenant, property, room) {
  const message =
    `📌 طلب حجز جديد\n\n` +
    `🆔 رقم الحجز: ${booking.id}\n` +
    `📅 تاريخ الطلب: ${new Date(booking.createdAt).toLocaleString("ar-EG")}\n\n` +
    `👤 بيانات العميل\n` +
    `• الاسم: ${tenant.firstName} ${tenant.lastName}\n` +
    `• رقم الهاتف: ${tenant.phone}\n` +
    `• البريد الإلكتروني: ${tenant.email}\n\n` +
    `🏠 بيانات العقار\n` +
    `• اسم العقار: ${property.title}\n` +
    `• المدينة: ${property.city}\n` +
    `• الحي: ${property.district}\n\n` +
    `🛏️ بيانات الغرفة\n` +
    `• النوع: ${room.roomType}\n` +
    `• عدد الأسرة المطلوبة: ${booking.bedsRequested}\n` +
    `• السعر: ${room.pricePerBed} جنيه / سرير / شهر\n\n` +
    `📅 مدة الحجز\n` +
    `• من: ${new Date(booking.startDate).toLocaleDateString("ar-EG")}\n` +
    `• إلى: ${new Date(booking.endDate).toLocaleDateString("ar-EG")}\n` +
    `• عدد الشهور: ${booking.monthsCount}\n\n` +
    `💰 السعر الإجمالي: ${booking.totalPrice} جنيه\n\n` +
    `📋 حالة الحجز: ${booking.status}\n` +
    `📝 ملاحظات العميل: ${booking.note || "لا يوجد"}\n\n` +
    `يرجى التواصل مع العميل لاستكمال إجراءات الحجز.`;

  return `https://wa.me/${SUPER_ADMIN_WHATSAPP}?text=${encodeURIComponent(
    message,
  )}`;
}

const MAX_TX_ATTEMPTS = 3;
const IDEMPOTENCY_KEY_MAX_LENGTH = 100;

const bookingRelationsInclude = {
  tenant: {
    select: { firstName: true, lastName: true, phone: true, email: true },
  },
  property: {
    select: { title: true, city: true, district: true },
  },
};

async function safelyDispatchNotification(data, context = "") {
  try {
    await dispatchNotificationService(data);
  } catch (error) {
    console.error(`[Notification Error] ${context}`, error);
  }
}

function isSameRequest(booking, request) {
  return (
    String(booking.propertyId) === String(request.propertyId) &&
    String(booking.roomId) === String(request.roomId) &&
    booking.bedsRequested === request.bedsRequested &&
    booking.startDate.getTime() === request.startDate.getTime() &&
    booking.endDate.getTime() === request.endDate.getTime()
  );
}

async function lockRoom(tx, roomId) {
  const rows = await tx.$queryRaw`
    SELECT id FROM "property_rooms" WHERE id = ${roomId} FOR UPDATE
  `;
  return rows.length > 0;
}

export async function createBookingService(tenantId, body, t) {
  const { propertyId, roomId, startDate, endDate, note } = body;
  const bedsRequested = Number(body.bedsRequested ?? 1);

  if (!propertyId || !roomId) {
    throw new AppError(t("booking.propertyAndRoomRequired"), 400);
  }

  if (!startDate || !endDate) {
    throw new AppError(t("booking.datesRequired"), 400);
  }

  if (!Number.isInteger(bedsRequested) || bedsRequested < 1) {
    throw new AppError(t("booking.invalidBedsRequested"), 400);
  }

  const parsedStartDate = new Date(startDate);
  const parsedEndDate = new Date(endDate);

  if (
    Number.isNaN(parsedStartDate.getTime()) ||
    Number.isNaN(parsedEndDate.getTime())
  ) {
    throw new AppError(t("booking.invalidDates"), 400);
  }

  if (parsedStartDate >= parsedEndDate) {
    throw new AppError(t("booking.invalidDateRange"), 400);
  }

  const runTransaction = () =>
    prisma.$transaction(
      async (tx) => {
        const roomExists = await lockRoom(tx, roomId);
        if (!roomExists) {
          throw new AppError(t("property.roomNotFound"), 404);
        }

        const [property, room, closedBeds, existingBooking] = await Promise.all(
          [
            tx.property.findFirst({
              where: {
                id: propertyId,
                deletedAt: null,
                status: { in: ["APPROVED", "PENDING"] },
              },
              select: {
                id: true,
                isAvailable: true,
                owner: { select: { id: true, whatsappPhone: true } },
              },
            }),

            tx.propertyRoom.findFirst({
              where: { id: roomId, propertyId },
            }),

            tx.booking.aggregate({
              where: { roomId, status: "CLOSED" },
              _sum: { bedsRequested: true },
            }),

            tx.booking.findFirst({
              where: {
                tenantId,
                roomId,
                status: { in: ["PENDING", "CONTACTED", "CONFIRMED"] },
              },
              select: { id: true },
            }),
          ],
        );

        if (!property) {
          throw new AppError(t("property.notFound"), 404);
        }

        if (!property.isAvailable) {
          throw new AppError(t("booking.propertyNotAvailable"), 400);
        }

        if (!room) {
          throw new AppError(t("property.roomNotFound"), 404);
        }

        const totalClosed = Number(closedBeds._sum.bedsRequested) || 0;
        const computedAvailable = Math.max(
          0,
          Number(room.totalBeds || 1) - totalClosed,
        );
        const effectiveAvailableBeds = Math.min(
          room.availableBeds !== undefined && room.availableBeds !== null
            ? Number(room.availableBeds)
            : computedAvailable,
          computedAvailable,
        );

        if (room.status === "FULL" || effectiveAvailableBeds <= 0) {
          throw new AppError(t("booking.roomNotAvailable"), 400);
        }

        if (bedsRequested > effectiveAvailableBeds) {
          throw new AppError(t("booking.notEnoughBeds"), 400);
        }

        if (existingBooking) {
          throw new AppError(t("booking.alreadyRequested"), 409);
        }

        const monthsCount = calculateMonthsCount(
          parsedStartDate,
          parsedEndDate,
        );
        const totalPrice =
          Math.round(
            Number(room.pricePerBed) * bedsRequested * monthsCount * 100,
          ) / 100;

        const created = await tx.booking.create({
          data: {
            tenantId,
            propertyId,
            roomId,
            bedsRequested,
            monthsCount,
            totalPrice,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            note: typeof note === "string" ? note.trim() || null : null,
            status: "PENDING",
          },
          include: bookingRelationsInclude,
        });

        return {
          booking: { ...created, room },
          ownerId: property.owner.id,
          replayed: false,
        };
      },
      {
        isolationLevel: "ReadCommitted",
        maxWait: 5000,
        timeout: 10000,
      },
    );

  let result;
  try {
    result = await runTransaction();
  } catch (error) {
    if (error?.code === "P2002") {
      throw new AppError(t("booking.alreadyRequested"), 409);
    }
    if (error?.code === "P2028") {
      throw new AppError(t("booking.tryAgain"), 409);
    }
    throw error;
  }

  const { booking, ownerId, replayed } = result;

  if (!replayed) {
    clearDashboardBookingsCache(ownerId);
    if (ownerId) {
      deleteMemoryCache(`booking:property:${booking.propertyId}:${ownerId}`);
    }

    void safelyDispatchNotification(
      {
        userId: ownerId,
        event: "booking",
        channel: "in_app",
        title: "New Booking Request",
        body: `A new booking request has been submitted for ${booking.property.title}.`,
        payload: {
          bookingId: booking.id,
          propertyId: booking.propertyId,
          roomId: booking.roomId,
          tenantId,
          bedsRequested: booking.bedsRequested,
          monthsCount: booking.monthsCount,
          totalPrice: booking.totalPrice,
          startDate: booking.startDate,
          endDate: booking.endDate,
          status: booking.status,
        },
        relatedEntityType: "booking",
        relatedEntityId: booking.id,
      },
      `booking notification for booking ${booking.id}`,
    );
  }

  const whatsappLink = buildWhatsappLink(
    booking,
    booking.tenant,
    booking.property,
    booking.room,
  );

  return { booking, whatsappLink, replayed };
}

export async function getMyBookingsService(tenantId, t) {
  return prisma.booking.findMany({
    where: { tenantId },
    select: {
      id: true,
      tenantId: true,
      propertyId: true,
      roomId: true,
      bedsRequested: true,
      monthsCount: true,
      totalPrice: true,
      startDate: true,
      endDate: true,
      assignedAdminId: true,
      status: true,
      note: true,
      contactedAt: true,
      createdAt: true,
      updatedAt: true,
      property: {
        select: {
          title: true,
          city: true,
          images: {
            where: { isPrimary: true },
            take: 1,
          },
        },
      },
      room: true,
      contract: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// Get Single Booking
export async function getBookingByIdService(id, userId, isAdmin, t) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      property: true,
      room: true,
      tenant: {
        select: {
          firstName: true,
          lastName: true,
          whatsappPhone: true,
          avatar: true,
        },
      },
      assignedAdmin: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      contract: true,
    },
  });

  if (!booking) {
    throw new AppError(t("booking.notFound"), 404);
  }

  const isOwnerOfBooking = booking.tenantId === userId;
  const isAssignedAdmin = booking.assignedAdminId === userId;

  if (!isOwnerOfBooking && !isAssignedAdmin && !isAdmin) {
    throw new AppError(t("common.forbidden"), 403);
  }

  return booking;
}

const inFlightPropertyBookings = new Map();

// Get Bookings for Owner
export async function getPropertyBookingsService(propertyId, ownerId, t) {
  const cacheKey = `booking:property:${propertyId}:${ownerId}`;
  const cached = getMemoryCache(cacheKey);
  if (cached !== null) return cached;

  if (inFlightPropertyBookings.has(cacheKey)) {
    return inFlightPropertyBookings.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const property = await prisma.property.findFirst({
        where: {
          id: propertyId,
          deletedAt: null,
        },
        select: {
          ownerId: true,
        },
      });

      if (!property) {
        throw new AppError(t("property.notFound"), 404);
      }

      if (property.ownerId !== ownerId) {
        throw new AppError(t("common.forbidden"), 403);
      }

      const bookings = await prisma.booking.findMany({
        where: { propertyId },
        select: {
          id: true,
          tenantId: true,
          propertyId: true,
          roomId: true,
          bedsRequested: true,
          monthsCount: true,
          totalPrice: true,
          startDate: true,
          endDate: true,
          assignedAdminId: true,
          status: true,
          note: true,
          contactedAt: true,
          createdAt: true,
          updatedAt: true,
          room: true,
          tenant: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              whatsappPhone: true,
              avatar: true,
            },
          },
          contract: true,
        },
        orderBy: { createdAt: "desc" },
      });

      setMemoryCache(cacheKey, bookings, 60);
      return bookings;
    } finally {
      inFlightPropertyBookings.delete(cacheKey);
    }
  })();

  inFlightPropertyBookings.set(cacheKey, promise);
  return promise;
}

// Get All Bookings - Filter + Pagination
export async function getAllBookingsService(query, t) {
  const cacheKey = generateDashboardKey("dashboard:bookings:list", query);
  return getOrSetDashboardCache(cacheKey, DASHBOARD_TTL.LIST, async () => {
    const features = new BookingCalendarApiFeatures(query)
      .filter()
      .sort()
      .paginate();

    if (!query.status) {
      delete features.where.status;
    }

    if (!query.sort) {
      features.orderBy = { createdAt: "desc" };
    }

    const result = await features.execute(prisma.booking);

    return {
      data: result.data,
      bookings: result.data,
      meta: {
        total: result.totalCount,
        page: result.currentPage,
        limit: features.take,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
        nextCursor: result.nextCursor,
      },
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      totalCount: result.totalCount,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
      nextCursor: result.nextCursor,
    };
  });
}

// Assign Admin to Booking
export async function assignAdminToBookingService(bookingId, adminId, t) {
  const { count } = await prisma.booking.updateMany({
    where: { id: bookingId, assignedAdminId: null },
    data: { assignedAdminId: adminId },
  });

  if (count === 0) {
    const existing = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, assignedAdminId: true },
    });

    if (!existing) {
      throw new AppError(t("booking.notFound"), 404);
    }
    throw new AppError(t("booking.alreadyAssigned"), 409);
  }

  const updatedBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  void safelyDispatchNotification(
    {
      userId: adminId,
      event: "booking",
      channel: "in_app",
      title: "Booking Assigned",
      body: "A booking has been assigned to you.",
      payload: {
        action: "admin_assigned",
        bookingId: updatedBooking.id,
        propertyId: updatedBooking.propertyId,
        roomId: updatedBooking.roomId,
        tenantId: updatedBooking.tenantId,
        bedsRequested: updatedBooking.bedsRequested,
        monthsCount: updatedBooking.monthsCount,
        totalPrice: updatedBooking.totalPrice,
        startDate: updatedBooking.startDate,
        endDate: updatedBooking.endDate,
        status: updatedBooking.status,
        assignedAdminId: updatedBooking.assignedAdminId,
      },
      relatedEntityType: "booking",
      relatedEntityId: updatedBooking.id,
    },
    `admin assignment notification for booking ${bookingId}`,
  );

  return updatedBooking;
}

const ALLOWED_TRANSITIONS = {
  PENDING: ["CONTACTED", "CONFIRMED", "CLOSED", "CANCELLED", "PENDING"],
  CONTACTED: ["CONFIRMED", "CLOSED", "CANCELLED", "PENDING", "CONTACTED"],
  CONFIRMED: ["CLOSED", "CANCELLED", "CONTACTED", "PENDING", "CONFIRMED"],
  CLOSED: ["CANCELLED", "CONFIRMED", "CONTACTED", "PENDING", "CLOSED"],
  CANCELLED: ["PENDING", "CONTACTED", "CONFIRMED", "CLOSED", "CANCELLED"],
};

export async function updateBookingStatusService(
  bookingId,
  adminId,
  status,
  note,
  t,
) {
  const normalizedStatus = String(status || "")
    .trim()
    .toUpperCase();

  const result = await prisma.$transaction(async (tx) => {
    const initial = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { roomId: true },
    });

    if (!initial) {
      throw new AppError(t("booking.notFound"), 404);
    }

    if (initial.roomId) {
      await lockRoom(tx, initial.roomId);
    }

    const fresh = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        room: true,
        contract: true,
        property: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!fresh) {
      throw new AppError(t("booking.notFound"), 404);
    }

    const currentStatus = String(fresh.status || "")
      .trim()
      .toUpperCase();

    if (currentStatus === normalizedStatus) {
      let bookingRecord = fresh;
      if (
        typeof note === "string" &&
        note.trim() &&
        note.trim() !== fresh.note
      ) {
        bookingRecord = await tx.booking.update({
          where: { id: bookingId },
          data: { note: note.trim() },
          include: {
            room: true,
            contract: true,
            property: {
              select: {
                ownerId: true,
              },
            },
          },
        });
      }
      return {
        updatedBooking: bookingRecord,
        previousStatus: currentStatus,
        assignedAdminId: fresh.assignedAdminId,
        unchanged: true,
        newlyAssignedToAdmin: false,
      };
    }

    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [
      "CONTACTED",
      "CONFIRMED",
      "CLOSED",
      "CANCELLED",
      "PENDING",
    ];

    if (!allowedNext.includes(normalizedStatus)) {
      throw new AppError(t("booking.invalidStatusTransition"), 400);
    }

    const data = {
      status: normalizedStatus,
    };

    if (typeof note === "string") {
      data.note = note.trim() || null;
    }

    let assignedAdminId = fresh.assignedAdminId;
    let newlyAssignedToAdmin = false;

    if (normalizedStatus === "CONTACTED" || normalizedStatus === "CONFIRMED") {
      data.contactedAt = fresh.contactedAt || new Date();

      if (!fresh.assignedAdminId) {
        data.assignedAdminId = adminId;
        assignedAdminId = adminId;
        newlyAssignedToAdmin = true;
      }
    }

    // 3) Beds: react to entering / leaving CLOSED (covers CLOSED -> CONFIRMED / CONTACTED / CANCELLED / PENDING)
    const wasClosed = currentStatus === "CLOSED";
    const willBeClosed = normalizedStatus === "CLOSED";

    if (fresh.roomId && wasClosed !== willBeClosed) {
      const room = await tx.propertyRoom.findUnique({
        where: { id: fresh.roomId },
      });
      const beds = fresh.bedsRequested || 1;

      if (room) {
        let newAvailable;
        if (willBeClosed) {
          if (room.availableBeds < beds) {
            throw new AppError(t("booking.notEnoughBeds"), 400);
          }
          newAvailable = room.availableBeds - beds;
        } else {
          newAvailable = Math.min(room.totalBeds, room.availableBeds + beds);
        }

        await tx.propertyRoom.update({
          where: { id: room.id },
          data: {
            availableBeds: newAvailable,
            status: newAvailable > 0 ? "AVAILABLE" : "FULL",
          },
        });
      }
    }

    // 4) Contract synchronization
    if (fresh.contract) {
      if (willBeClosed && !wasClosed) {
        if (
          fresh.contract.status !== "ACTIVE" &&
          fresh.contract.status !== "CANCELLED"
        ) {
          await tx.contract.update({
            where: { id: fresh.contract.id },
            data: { status: "ACTIVE" },
          });
        }
      } else if (wasClosed && !willBeClosed) {
        if (fresh.contract.status === "ACTIVE") {
          await tx.contract.update({
            where: { id: fresh.contract.id },
            data: { status: "CANCELLED" },
          });
        }
      }
    }

    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data,
      include: {
        room: true,
        contract: true,
        property: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    return {
      updatedBooking,
      previousStatus: currentStatus,
      assignedAdminId,
      unchanged: false,
      newlyAssignedToAdmin,
    };
  });

  const {
    updatedBooking,
    previousStatus,
    assignedAdminId,
    unchanged,
    newlyAssignedToAdmin,
  } = result;

  const ownerId = updatedBooking.property?.ownerId;
  clearDashboardBookingsCache(ownerId);
  clearPropertyCache();
  deleteMemoryCache(`properties:id:${updatedBooking.propertyId}`);
  if (ownerId) {
    deleteMemoryCache(`properties:my:${ownerId}`);
    deleteMemoryCache(
      `booking:property:${updatedBooking.propertyId}:${ownerId}`,
    );
  }
  deleteMemoryCache("properties:all");

  if (!unchanged) {
    const statusNotificationMap = {
      CONTACTED: {
        title: "Booking Request Contacted",
        body: "Your booking request is now being handled.",
        action: "contacted",
      },
      CONFIRMED: {
        title: "Booking Confirmed",
        body: "Your booking has been approved and is awaiting final completion/contract.",
        action: "confirmed",
      },
      CLOSED: {
        title: "Booking Closed",
        body: "Your booking process has been completed.",
        action: "closed",
      },
      CANCELLED: {
        title: "Booking Cancelled",
        body: "Your booking request has been cancelled.",
        action: "cancelled",
      },
    };

    const notification = statusNotificationMap[normalizedStatus];

    if (notification) {
      void safelyDispatchNotification(
        {
          userId: updatedBooking.tenantId,
          event: "booking",
          channel: "in_app",
          title: notification.title,
          body: notification.body,
          payload: {
            action: notification.action,
            bookingId: updatedBooking.id,
            propertyId: updatedBooking.propertyId,
            roomId: updatedBooking.roomId,
            tenantId: updatedBooking.tenantId,
            bedsRequested: updatedBooking.bedsRequested,
            monthsCount: updatedBooking.monthsCount,
            totalPrice: updatedBooking.totalPrice,
            startDate: updatedBooking.startDate,
            endDate: updatedBooking.endDate,
            previousStatus,
            status: updatedBooking.status,
            assignedAdminId,
            note: updatedBooking.note,
          },
          relatedEntityType: "booking",
          relatedEntityId: updatedBooking.id,
        },
        `booking status notification for ${bookingId}`,
      );
    }

    if (normalizedStatus === "CONTACTED" && newlyAssignedToAdmin) {
      void safelyDispatchNotification(
        {
          userId: adminId,
          event: "booking",
          channel: "in_app",
          title: "Booking Assigned",
          body: "A booking has been assigned to you.",
          payload: {
            action: "admin_assigned",
            bookingId: updatedBooking.id,
            propertyId: updatedBooking.propertyId,
            roomId: updatedBooking.roomId,
            tenantId: updatedBooking.tenantId,
            bedsRequested: updatedBooking.bedsRequested,
            monthsCount: updatedBooking.monthsCount,
            totalPrice: updatedBooking.totalPrice,
            startDate: updatedBooking.startDate,
            endDate: updatedBooking.endDate,
            previousStatus,
            status: updatedBooking.status,
            assignedAdminId: adminId,
          },
          relatedEntityType: "booking",
          relatedEntityId: updatedBooking.id,
        },
        `admin assignment notification for booking ${bookingId}`,
      );
    }
  }

  return updatedBooking;
}

export async function cancelBookingService(bookingId, tenantId, t) {
  const { count } = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      tenantId,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
    },
  });

  if (count === 0) {
    const existing = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        tenantId,
      },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new AppError(t("booking.notFound"), 404);
    }

    throw new AppError(t("booking.cannotCancel"), 400);
  }

  const updatedBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: {
        select: {
          ownerId: true,
        },
      },
    },
  });

  const ownerId = updatedBooking.property?.ownerId;
  clearDashboardBookingsCache(ownerId);
  clearPropertyCache();
  deleteMemoryCache(`properties:id:${updatedBooking.propertyId}`);
  if (ownerId) {
    deleteMemoryCache(`properties:my:${ownerId}`);
    deleteMemoryCache(
      `booking:property:${updatedBooking.propertyId}:${ownerId}`,
    );
  }
  deleteMemoryCache("properties:all");

  const recipientId =
    updatedBooking.assignedAdminId || updatedBooking.property?.ownerId;

  if (recipientId) {
    void safelyDispatchNotification(
      {
        userId: recipientId,
        event: "booking",
        channel: "in_app",
        title: "Booking Cancelled",
        body: "A booking request has been cancelled by the tenant.",
        payload: {
          action: "cancelled",
          bookingId: updatedBooking.id,
          propertyId: updatedBooking.propertyId,
          roomId: updatedBooking.roomId,
          tenantId: updatedBooking.tenantId,
          bedsRequested: updatedBooking.bedsRequested,
          monthsCount: updatedBooking.monthsCount,
          totalPrice: updatedBooking.totalPrice,
          startDate: updatedBooking.startDate,
          endDate: updatedBooking.endDate,
          previousStatus: "PENDING",
          status: updatedBooking.status,
        },
        relatedEntityType: "booking",
        relatedEntityId: updatedBooking.id,
      },
      `cancellation notification for booking ${bookingId}`,
    );
  }

  return updatedBooking;
}


