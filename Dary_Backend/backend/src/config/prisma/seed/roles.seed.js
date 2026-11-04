import { prisma } from "../PrismaService.js";

const roles = [
  {
    name: "super_admin",
    description: "Has full access to the entire system",
  },
  {
    name: "admin",
    description: "Manages system operations and users",
  },
  {
    name: "owner",
    description: "Owns and manages properties",
  },
  {
    name: "tenant",
    description: "Books and rents properties",
  },
];

export async function seedRoles() {
  console.log("Seeding roles...");

  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        name: role.name,
      },
      update: {
        description: role.description,
      },
      create: role,
    });
  }

  console.log(` ${roles.length} roles seeded successfully.`);
}
