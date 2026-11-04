import bcrypt from "bcrypt";
import { prisma } from "../PrismaService.js";

export async function seedAdminUser() {
  try {
    let superAdminRole = await prisma.role.findUnique({
      where: { name: "super_admin" },
    });

    if (!superAdminRole) {
      superAdminRole = await prisma.role.create({
        data: {
          name: "super_admin",
          description: "Has full access to the entire system",
        },
      });
    }

    const defaultAdmins = [
      {
        email: "admin@dary.dev",
        password: "Password123!",
        firstName: "مدير",
        lastName: "النظام",
      },
      {
        email: "admin@dary.com",
        password: "Password123!",
        firstName: "Admin",
        lastName: "Dary",
      },
      {
        email: "admin@dary.ae",
        password: "Password123!",
        firstName: "عبد الرحمن",
        lastName: "الشمري",
      },
    ];

    for (const adminData of defaultAdmins) {
      try {
        const existing = await prisma.user.findFirst({
          where: { email: adminData.email },
        });

        const hashedPassword = await bcrypt.hash(adminData.password, 10);

        let user;
        if (!existing) {
          user = await prisma.user.create({
            data: {
              firstName: adminData.firstName,
              lastName: adminData.lastName,
              email: adminData.email,
              password: hashedPassword,
              status: "ACTIVE",
              isVerified: true,
            },
          });
        } else {
          user = await prisma.user.update({
            where: { id: existing.id },
            data: {
              password: hashedPassword,
              status: "ACTIVE",
              isVerified: true,
            },
          });
        }

        const existingRole = await prisma.userRole.findUnique({
          where: {
            userId_roleId: {
              userId: user.id,
              roleId: superAdminRole.id,
            },
          },
        });

        if (!existingRole) {
          await prisma.userRole.create({
            data: {
              userId: user.id,
              roleId: superAdminRole.id,
            },
          });
        }

        const existingProfile = await prisma.profile.findUnique({
          where: { userId: user.id },
        });

        if (!existingProfile) {
          await prisma.profile.create({
            data: {
              userId: user.id,
              city: "القاهرة",
              country: "مصر",
              bio: "المدير العام لمنصة داري لسكن الطلاب.",
            },
          });
        }
      } catch (innerErr) {
        console.warn(`[SeedAdmin] Skip ${adminData.email}:`, innerErr.message);
      }
    }
  } catch (err) {
    console.warn("[SeedAdmin] Global notice:", err.message);
  }
}
