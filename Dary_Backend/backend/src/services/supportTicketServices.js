import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";
import { dispatchNotificationService } from "./notificationServices.js";
import { TicketApiFeatures } from "../utils/api-features.js";

async function safelyDispatchNotification(data, context = "") {
  try {
    await dispatchNotificationService(data);
  } catch (error) {
    console.error(`[Notification Error] ${context}`, error);
  }
}

// Create Ticket
export async function createTicketService(userId, body, t) {
  const { category, subject, description } = body;

  if (!category || !subject || !description) {
    throw new AppError(t("ticket.missingFields"), 400);
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      category,
      subject,
      description,
      status: "OPEN",

      messages: {
        create: {
          senderId: userId,
          message: description,
        },
      },
    },

    include: {
      messages: true,
    },
  });

  const admins = await prisma.user.findMany({
    where: {
      userRoles: {
        some: {
          role: {
            name: {
              in: ["admin", "super_admin"],
            },
          },
        },
      },
    },

    select: {
      id: true,
    },
  });

  await Promise.allSettled(
    admins.map((admin) =>
      dispatchNotificationService({
        userId: admin.id,
        event: "ticket.created",
        channel: "in_app",
        title: "New Support Ticket",
        body: `A new support ticket has been created: ${subject}`,
        payload: {
          ticketId: ticket.id,
          userId,
          category,
          subject,
          status: ticket.status,
        },
        relatedEntityType: "support_ticket",
        relatedEntityId: ticket.id,
      }),
    ),
  );
  return ticket;
}

// Get My Tickets
export async function getMyTicketsService(userId, t) {
  return prisma.supportTicket.findMany({
    where: {
      userId,
    },

    include: {
      assignedAdmin: {
        select: {
          firstName: true,
          lastName: true,
        },
      },

      _count: {
        select: {
          messages: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}

// Check Ticket Access
async function assertTicketAccess(ticketId, userId, isAdmin, t) {
  const ticket = await prisma.supportTicket.findUnique({
    where: {
      id: ticketId,
    },
  });

  if (!ticket) {
    throw new AppError(t("ticket.notFound"), 404);
  }

  const isOwner = ticket.userId === userId;

  const isAssignedAdmin = ticket.assignedAdminId === userId;

  if (!isOwner && !isAssignedAdmin && !isAdmin) {
    throw new AppError(t("common.forbidden"), 403);
  }

  return ticket;
}

// Get Ticket By ID
export async function getTicketByIdService(ticketId, userId, isAdmin, t) {
  await assertTicketAccess(ticketId, userId, isAdmin, t);

  return prisma.supportTicket.findUnique({
    where: {
      id: ticketId,
    },

    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
        },
      },

      assignedAdmin: {
        select: {
          firstName: true,
          lastName: true,
        },
      },

      messages: {
        include: {
          sender: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },

          attachments: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

// Add Message
export async function addTicketMessageService(
  ticketId,
  senderId,
  message,
  files,
  isAdmin,
  t,
) {
  const ticket = await assertTicketAccess(ticketId, senderId, isAdmin, t);

  if (!message && (!files || files.length === 0)) {
    throw new AppError(t("ticket.messageRequired"), 400);
  }

  if (ticket.status === "ARCHIVED") {
    throw new AppError(t("ticket.ticketArchived"), 400);
  }

  /*
   * IMPORTANT:
   * uploadAttachment already uploads files to Cloudinary.
   * Therefore, DO NOT use file.buffer here.
   */

  const uploadedFiles = files || [];

  const newMessage = await prisma.ticketMessage.create({
    data: {
      ticketId,

      senderId,

      message: message || "",

      attachments: {
        create: uploadedFiles.map((file) => ({
          url: file.secure_url,

          publicId: file.public_id,

          type: file.mimetype,
        })),
      },
    },

    include: {
      sender: {
        select: {
          firstName: true,
          lastName: true,
          avatar: true,
        },
      },

      attachments: true,
    },
  });

  if (ticket.status === "RESOLVED") {
    await prisma.supportTicket.update({
      where: {
        id: ticketId,
      },

      data: {
        status: "OPEN",
        resolvedAt: null,
      },
    });
  }

  const recipientId =
    senderId === ticket.userId ? ticket.assignedAdminId : ticket.userId;

  if (recipientId) {
    await safelyDispatchNotification(
      {
        userId: recipientId,

        event: "ticket.message.created",

        channel: "in_app",

        title: t("ticket.newMessageTitle"),

        body: message || t("ticket.newAttachmentBody"),

        payload: {
          ticketId,

          messageId: newMessage.id,

          senderId,

          sender: newMessage.sender,

          hasAttachments: newMessage.attachments.length > 0,

          attachmentsCount: newMessage.attachments.length,

          ticketStatus: ticket.status === "RESOLVED" ? "OPEN" : ticket.status,
        },

        relatedEntityType: "support_ticket",

        relatedEntityId: ticketId,
      },

      `notify ticket message recipient for ${ticketId}`,
    );
  }

  return newMessage;
}

// Allowed Status
const ALLOWED_TRANSITIONS = {
  OPEN: ["INVESTIGATING", "ARCHIVED"],

  INVESTIGATING: ["RESOLVED", "ARCHIVED"],

  RESOLVED: ["ARCHIVED", "INVESTIGATING"],

  ARCHIVED: [],
};

// Update Ticket Status
export async function updateTicketStatusService(ticketId, adminId, status, t) {
  const ticket = await prisma.supportTicket.findUnique({
    where: {
      id: ticketId,
    },
  });

  if (!ticket) {
    throw new AppError(t("ticket.notFound"), 404);
  }

  const allowedNext = ALLOWED_TRANSITIONS[ticket.status] || [];

  if (!allowedNext.includes(status)) {
    throw new AppError(t("ticket.invalidStatusTransition"), 400);
  }

  const data = {
    status,
  };

  if (status === "RESOLVED") {
    data.resolvedAt = new Date();
  }

  if (status === "INVESTIGATING" && ticket.status === "RESOLVED") {
    data.resolvedAt = null;
  }

  const shouldAutoAssign =
    status === "INVESTIGATING" && !ticket.assignedAdminId;

  if (shouldAutoAssign) {
    data.assignedAdminId = adminId;
  }

  const updatedTicket = await prisma.supportTicket.update({
    where: {
      id: ticketId,
    },

    data,
  });

  const statusNotifications = {
    INVESTIGATING: {
      event: "ticket.investigating",
      title: "Ticket Under Investigation",
      body: "Your support ticket is now being investigated.",
    },

    RESOLVED: {
      event: "ticket.resolved",
      title: "Ticket Resolved",
      body: "Your support ticket has been resolved.",
    },

    ARCHIVED: {
      event: "ticket.archived",
      title: "Ticket Archived",
      body: "Your support ticket has been archived.",
    },
  };

  const notification = statusNotifications[status];

  if (notification) {
    await safelyDispatchNotification(
      {
        userId: ticket.userId,
        event: notification.event,
        channel: "in_app",
        title: notification.title,
        body: notification.body,
        payload: {
          ticketId: updatedTicket.id,
          previousStatus: ticket.status,
          status: updatedTicket.status,
          assignedAdminId: updatedTicket.assignedAdminId,
          resolvedAt: updatedTicket.resolvedAt,
        },
        relatedEntityType: "support_ticket",
        relatedEntityId: updatedTicket.id,
      },

      `notify ticket owner about ${status}`,
    );
  }

  if (shouldAutoAssign) {
    await safelyDispatchNotification(
      {
        userId: adminId,

        event: "ticket.assigned",

        channel: "in_app",

        title: "Support Ticket Assigned",

        body: "A support ticket has been assigned to you.",

        payload: {
          ticketId: updatedTicket.id,

          subject: updatedTicket.subject,

          category: updatedTicket.category,

          status: updatedTicket.status,

          assignedAdminId: updatedTicket.assignedAdminId,
        },

        relatedEntityType: "support_ticket",

        relatedEntityId: updatedTicket.id,
      },

      `auto assign ticket ${ticketId}`,
    );
  }

  return updatedTicket;
}







// Get All Tickets
export async function getAllTicketsService(query, t) {
  const features = new TicketApiFeatures(query).filter().sort().paginate();

  const result = await features.execute(prisma.supportTicket, {
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },

      assignedAdmin: {
        select: {
          firstName: true,
          lastName: true,
        },
      },

      _count: {
        select: {
          messages: true,
        },
      },
    },
  });

  return {
    data: result.data,
    meta: result.meta,
  };
}
