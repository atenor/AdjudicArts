import { seedProduction } from "./seed";
import { prisma } from "../lib/prisma";

seedProduction()
  .catch((error) => {
    console.error("❌ Production seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
