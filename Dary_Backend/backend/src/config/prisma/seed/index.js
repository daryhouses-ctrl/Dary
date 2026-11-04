import { seedPermissions } from "./permissions.seed.js";
import { seedRoles } from "./roles.seed.js";
import { seedRolePermissions } from "./rolePermissions.seed.js";
import { prisma } from "../PrismaService.js";

async function main() {
  try {
    await seedPermissions();
    await seedRoles();
    await seedRolePermissions();

    console.log(" Database seeding completed successfully.");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
