/**
 * Standalone super-admin seed.
 *
 * Usage:
 *   SEED_SA_EMAIL=you@company.com SEED_SA_PASSWORD=secret SEED_SA_NAME="Your Name" \
 *   npx tsx prisma/seed-superadmin.ts
 *
 * Safe to re-run — uses upsert (updates name + password if email already exists).
 */
import { PrismaClient } from "@prisma/client";
import { seedSuperAdmin } from "./seed";

const prisma = new PrismaClient();

seedSuperAdmin()
  .then((sa) => {
    console.log(`\n✅ SuperAdmin ready: ${sa.email}`);
    console.log(`   Login at: ${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/superadmin/login`);
  })
  .catch((err) => {
    console.error("❌ SuperAdmin seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
