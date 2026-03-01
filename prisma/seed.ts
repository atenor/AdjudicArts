/**
 * AdjudicArts — Prisma Seed
 *
 * Creates:
 *  - 1 Organization
 *  - 1 Admin, 1 National Chair, 1 Chapter Chair
 *  - 2 Chapter Judges, 2 National Judges
 *  - 9 Applicants
 *  - 1 Event (OPEN) with 1 chapter round + 1 national round
 *  - Full 10-criterion rubric
 *  - JudgeAssignments for both round types
 *
 * All passwords: password123 (bcrypt-hashed)
 */

import { PrismaClient, Role, EventStatus, RoundType, ApplicationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildApplicationMetadata } from "../lib/application-metadata";
import crypto from "crypto";

const prisma = new PrismaClient();

const CRITERIA = [
  { order: 1, name: "Vocal Technique", description: "Breath support, register transitions, physical production" },
  { order: 2, name: "Tone Quality", description: "Beauty, consistency, and appropriateness of sound" },
  { order: 3, name: "Intonation Accuracy", description: "Pitch accuracy throughout the performance" },
  { order: 4, name: "Diction/Language", description: "Clarity and accuracy of text delivery in the sung language" },
  { order: 5, name: "Musicality", description: "Phrasing, dynamics, rhythm, and musical sensitivity" },
  { order: 6, name: "Acting/Interpretation", description: "Emotional depth and character portrayal" },
  { order: 7, name: "Stylistic Appropriateness", description: "Period style, genre awareness, historical understanding" },
  { order: 8, name: "Stage Presence", description: "Command of stage, physical engagement, audience connection" },
  { order: 9, name: "Repertoire Selection", description: "Appropriateness and challenge level of chosen repertoire" },
  { order: 10, name: "Artistic Potential / X-Factor", description: "Overall impression, uniqueness, potential for growth" },
];

export async function seedDevelopment() {
  console.log("🌱 Seeding AdjudicArts...");

  const passwordHash = await bcrypt.hash("password123", 12);

  // ── Organization ────────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: "org-seed-001" },
    update: {},
    create: {
      id: "org-seed-001",
      name: "National Classical Voice Foundation",
    },
  });
  console.log(`✓ Organization: ${org.name}`);

  // ── Helper to upsert users ───────────────────────────────────────────────────
  async function upsertUser(
    id: string,
    email: string,
    name: string,
    role: Role
  ) {
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: { id, organizationId: org.id, email, name, role, passwordHash },
    });
  }

  // ── Users ───────────────────────────────────────────────────────────────────
  const admin = await upsertUser("user-admin-001", "admin@adjudicarts.dev", "Alex Admin", Role.ADMIN);
  const nationalChair = await upsertUser("user-natchair-001", "nationalchair@adjudicarts.dev", "Nicole Chair", Role.NATIONAL_CHAIR);
  const chapterChair = await upsertUser("user-chchair-001", "chapterchair@adjudicarts.dev", "Charles Chair", Role.CHAPTER_CHAIR);
  const chJudge1 = await upsertUser("user-chjudge-001", "chapterjudge1@adjudicarts.dev", "Clara Judge", Role.CHAPTER_JUDGE);
  const chJudge2 = await upsertUser("user-chjudge-002", "chapterjudge2@adjudicarts.dev", "Carlos Judge", Role.CHAPTER_JUDGE);
  const natJudge1 = await upsertUser("user-natjudge-001", "nationaljudge1@adjudicarts.dev", "Nathan Judge", Role.NATIONAL_JUDGE);
  const natJudge2 = await upsertUser("user-natjudge-002", "nationaljudge2@adjudicarts.dev", "Nina Judge", Role.NATIONAL_JUDGE);
  const applicant1 = await upsertUser("user-applicant-001", "applicant1@adjudicarts.dev", "Alice Soprano", Role.APPLICANT);
  const applicant2 = await upsertUser("user-applicant-002", "applicant2@adjudicarts.dev", "Ben Tenor", Role.APPLICANT);
  const applicant3 = await upsertUser("user-applicant-003", "applicant3@adjudicarts.dev", "Carmen Mezzo", Role.APPLICANT);
  const applicant4 = await upsertUser("user-applicant-004", "applicant4@adjudicarts.dev", "Diego Baritone", Role.APPLICANT);
  const applicant5 = await upsertUser("user-applicant-005", "applicant5@adjudicarts.dev", "Elena Soprano", Role.APPLICANT);
  const applicant6 = await upsertUser("user-applicant-006", "applicant6@adjudicarts.dev", "Felix Bass", Role.APPLICANT);
  const applicant7 = await upsertUser("user-applicant-007", "applicant7@adjudicarts.dev", "Gia Mezzo", Role.APPLICANT);
  const applicant8 = await upsertUser("user-applicant-008", "applicant8@adjudicarts.dev", "Hugo Tenor", Role.APPLICANT);
  const applicant9 = await upsertUser("user-applicant-009", "isabelladoriano@icloud.com", "Isabella D’Oriano", Role.APPLICANT);

  console.log(`✓ Users created (16 total)`);

  // ── Event ───────────────────────────────────────────────────────────────────
  const event = await prisma.event.upsert({
    where: { id: "event-seed-001" },
    update: {},
    create: {
      id: "event-seed-001",
      organizationId: org.id,
      name: "2025 National Classical Voice Scholarship",
      description: "Annual national competition for classical voice students.",
      status: EventStatus.OPEN,
      openAt: new Date("2025-01-15T00:00:00Z"),
      closeAt: new Date("2025-03-15T23:59:59Z"),
    },
  });
  console.log(`✓ Event: ${event.name} (${event.status})`);

  // ── Rounds ──────────────────────────────────────────────────────────────────
  const chapterRound = await prisma.round.upsert({
    where: { id: "round-chapter-001" },
    update: {},
    create: {
      id: "round-chapter-001",
      organizationId: org.id,
      eventId: event.id,
      name: "Chapter Qualifying Round",
      type: RoundType.CHAPTER,
      startAt: new Date("2025-03-20T00:00:00Z"),
      endAt: new Date("2025-04-10T23:59:59Z"),
    },
  });

  const nationalRound = await prisma.round.upsert({
    where: { id: "round-national-001" },
    update: {},
    create: {
      id: "round-national-001",
      organizationId: org.id,
      eventId: event.id,
      name: "National Finals",
      type: RoundType.NATIONAL,
      startAt: new Date("2025-05-01T00:00:00Z"),
      endAt: new Date("2025-05-15T23:59:59Z"),
    },
  });
  console.log(`✓ Rounds: Chapter + National`);

  // ── Rubric ──────────────────────────────────────────────────────────────────
  const rubric = await prisma.rubric.upsert({
    where: { eventId: event.id },
    update: {},
    create: {
      id: "rubric-seed-001",
      organizationId: org.id,
      eventId: event.id,
      name: "Classical Voice Scholarship Rubric",
      description: "10 criteria scored 0–10 each; maximum 100 points.",
      criteria: {
        create: CRITERIA.map((c) => ({
          name: c.name,
          description: c.description,
          weight: 1.0,
          order: c.order,
        })),
      },
    },
  });
  console.log(`✓ Rubric: "${rubric.name}" with ${CRITERIA.length} criteria`);

  // ── Applications ─────────────────────────────────────────────────────────────
  async function upsertApplication(
    id: string,
    applicantId: string,
    repertoire: string,
    voicePart: string,
    status: ApplicationStatus = ApplicationStatus.SUBMITTED,
    videoUrls: string[] = []
  ) {
    return prisma.application.upsert({
      where: { id },
      update: {
        organizationId: org.id,
        eventId: event.id,
        applicantId,
        status,
        repertoire,
        notes: buildApplicationMetadata({ voicePart, videoUrls }),
      },
      create: {
        id,
        organizationId: org.id,
        eventId: event.id,
        applicantId,
        status,
        repertoire,
        notes: buildApplicationMetadata({ voicePart, videoUrls }),
      },
    });
  }

  await upsertApplication(
    "app-seed-001",
    applicant1.id,
    "Caro mio ben (Giordani), Vissi d'arte (Puccini)",
    "soprano",
    ApplicationStatus.NATIONAL_APPROVED,
    [
      "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/ysz5S6PUM-U",
    ]
  );
  await upsertApplication(
    "app-seed-002",
    applicant2.id,
    "La fleur que tu m'avais jetée (Bizet), Nessun dorma (Puccini)",
    "tenor",
    ApplicationStatus.NATIONAL_REVIEW,
    [
      "https://www.youtube.com/watch?v=jw61ZbebNQs&list=PLDS3fWB5tvXq3aHlVyS92qvmCdEPwdjhJ&index=1",
      "https://www.youtube.com/watch?v=viwqIWQkltc&list=PLDS3fWB5tvXq3aHlVyS92qvmCdEPwdjhJ&index=2",
      "https://www.youtube.com/watch?v=utG_JuIUuoI&list=PLDS3fWB5tvXq3aHlVyS92qvmCdEPwdjhJ&index=3",
    ]
  );
  await upsertApplication(
    "app-seed-003",
    applicant3.id,
    "O mio Fernando (Donizetti), Habanera (Bizet)",
    "mezzo",
    ApplicationStatus.CHAPTER_REVIEW
  );
  await upsertApplication(
    "app-seed-004",
    applicant4.id,
    "Di Provenza il mar (Verdi), Hai gia vinta la causa (Mozart)",
    "baritone",
    ApplicationStatus.SUBMITTED
  );
  await upsertApplication(
    "app-seed-005",
    applicant5.id,
    "Sempre libera (Verdi), Je veux vivre (Gounod)",
    "soprano",
    ApplicationStatus.CHAPTER_APPROVED
  );
  await upsertApplication(
    "app-seed-006",
    applicant6.id,
    "O Isis und Osiris (Mozart), Old Man River (Kern)",
    "bass",
    ApplicationStatus.CHAPTER_REJECTED
  );
  await upsertApplication(
    "app-seed-007",
    applicant7.id,
    "Mon coeur s'ouvre a ta voix (Saint-Saens), Must the winter come so soon? (Barber)",
    "mezzo",
    ApplicationStatus.NATIONAL_REJECTED
  );
  await upsertApplication(
    "app-seed-008",
    applicant8.id,
    "Che gelida manina (Puccini), Una furtiva lagrima (Donizetti)",
    "tenor",
    ApplicationStatus.SUBMITTED
  );
  await upsertApplication(
    "app-seed-009",
    applicant9.id,
    "Malinconia, ninfa gentile (Bellini), Hark! The Echoing Air (Purcell), Après un rêve (Fauré)",
    "soprano",
    ApplicationStatus.NATIONAL_REVIEW,
    [
      "https://www.youtube.com/watch?v=jw61ZbebNQs&list=PLDS3fWB5tvXq3aHlVyS92qvmCdEPwdjhJ&index=1",
      "https://www.youtube.com/watch?v=viwqIWQkltc&list=PLDS3fWB5tvXq3aHlVyS92qvmCdEPwdjhJ&index=2",
      "https://www.youtube.com/watch?v=utG_JuIUuoI&list=PLDS3fWB5tvXq3aHlVyS92qvmCdEPwdjhJ&index=3",
    ]
  );
  console.log(`✓ Applications: 9 seeded across workflow statuses`);

  // ── Judge Assignments ────────────────────────────────────────────────────────
  const judgeAssignments = [
    { id: "ja-ch-001", judgeId: chJudge1.id, roundId: chapterRound.id },
    { id: "ja-ch-002", judgeId: chJudge2.id, roundId: chapterRound.id },
    { id: "ja-nat-001", judgeId: natJudge1.id, roundId: nationalRound.id },
    { id: "ja-nat-002", judgeId: natJudge2.id, roundId: nationalRound.id },
  ];

  for (const ja of judgeAssignments) {
    await prisma.judgeAssignment.upsert({
      where: { judgeId_roundId: { judgeId: ja.judgeId, roundId: ja.roundId } },
      update: {},
      create: {
        id: ja.id,
        organizationId: org.id,
        judgeId: ja.judgeId,
        roundId: ja.roundId,
      },
    });
  }
  console.log(`✓ Judge assignments: 2 chapter, 2 national`);

  // ── SuperAdmin ───────────────────────────────────────────────────────────────
  await seedSuperAdmin();

  console.log("\n✅ Seed complete.");
  console.log("─────────────────────────────────────");
  console.log("Login credentials (all passwords: password123)");
  console.log(`  SuperAdmin:      sa@adjudicarts.dev  → /superadmin/login`);
  console.log(`  Admin:           admin@adjudicarts.dev`);
  console.log(`  National Chair:  nationalchair@adjudicarts.dev`);
  console.log(`  Chapter Chair:   chapterchair@adjudicarts.dev`);
  console.log(`  Chapter Judge 1: chapterjudge1@adjudicarts.dev`);
  console.log(`  Chapter Judge 2: chapterjudge2@adjudicarts.dev`);
  console.log(`  National Judge 1: nationaljudge1@adjudicarts.dev`);
  console.log(`  National Judge 2: nationaljudge2@adjudicarts.dev`);
  console.log(`  Applicant 1:     applicant1@adjudicarts.dev`);
  console.log(`  Applicant 2:     applicant2@adjudicarts.dev`);
  console.log(`  Applicant 3:     applicant3@adjudicarts.dev`);
  console.log(`  Applicant 4:     applicant4@adjudicarts.dev`);
  console.log(`  Applicant 5:     applicant5@adjudicarts.dev`);
  console.log(`  Applicant 6:     applicant6@adjudicarts.dev`);
  console.log(`  Applicant 7:     applicant7@adjudicarts.dev`);
  console.log(`  Applicant 8:     applicant8@adjudicarts.dev`);
  console.log(`  Applicant 9:     isabelladoriano@icloud.com`);
}

export async function seedProduction() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required for production seed");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const organization = await prisma.organization.upsert({
    where: { id: "org-prod-001" },
    update: { name: "Winston Voice" },
    create: {
      id: "org-prod-001",
      name: "Winston Voice",
    },
  });

  await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      name: "Winston Voice Admin",
      role: Role.ADMIN,
      organizationId: organization.id,
      passwordHash,
    },
    create: {
      id: "user-prod-admin-001",
      organizationId: organization.id,
      email: adminEmail.toLowerCase(),
      name: "Winston Voice Admin",
      role: Role.ADMIN,
      passwordHash,
    },
  });

  const event = await prisma.event.upsert({
    where: { id: "event-prod-001" },
    update: {
      organizationId: organization.id,
      name: "2026 Shirley Rabb Winston Scholarship Competition in Classical Voice",
      description: "Official Winston Voice scholarship adjudication event.",
      status: EventStatus.OPEN,
      openAt: new Date("2025-09-01T00:00:00Z"),
      closeAt: new Date("2026-04-30T23:59:59Z"),
    },
    create: {
      id: "event-prod-001",
      organizationId: organization.id,
      name: "2026 Shirley Rabb Winston Scholarship Competition in Classical Voice",
      description: "Official Winston Voice scholarship adjudication event.",
      status: EventStatus.OPEN,
      openAt: new Date("2025-09-01T00:00:00Z"),
      closeAt: new Date("2026-04-30T23:59:59Z"),
    },
  });

  await prisma.round.upsert({
    where: { id: "round-prod-chapter-001" },
    update: {
      organizationId: organization.id,
      eventId: event.id,
      name: "Chapter Round",
      type: RoundType.CHAPTER,
    },
    create: {
      id: "round-prod-chapter-001",
      organizationId: organization.id,
      eventId: event.id,
      name: "Chapter Round",
      type: RoundType.CHAPTER,
    },
  });

  await prisma.round.upsert({
    where: { id: "round-prod-national-001" },
    update: {
      organizationId: organization.id,
      eventId: event.id,
      name: "National Round",
      type: RoundType.NATIONAL,
    },
    create: {
      id: "round-prod-national-001",
      organizationId: organization.id,
      eventId: event.id,
      name: "National Round",
      type: RoundType.NATIONAL,
    },
  });

  const rubric = await prisma.rubric.upsert({
    where: { eventId: event.id },
    update: {
      organizationId: organization.id,
      name: "Winston Voice Rubric",
      description: "10 criteria scored 0–10 each.",
    },
    create: {
      id: "rubric-prod-001",
      organizationId: organization.id,
      eventId: event.id,
      name: "Winston Voice Rubric",
      description: "10 criteria scored 0–10 each.",
    },
  });

  const criteriaCount = await prisma.rubricCriteria.count({
    where: { rubricId: rubric.id },
  });
  if (criteriaCount === 0) {
    await prisma.rubricCriteria.createMany({
      data: CRITERIA.map((criterion) => ({
        rubricId: rubric.id,
        name: criterion.name,
        description: criterion.description,
        order: criterion.order,
        weight: 1.0,
      })),
    });
  }

  console.log("✅ Production seed complete.");
  console.log(`Organization: ${organization.name}`);
  console.log(`Event: ${event.name}`);
  console.log(`Admin: ${adminEmail.toLowerCase()}`);
}

/**
 * Seed a SuperAdmin account.
 *
 * Dev defaults: sa@adjudicarts.dev / password123
 * Production: set SEED_SA_EMAIL, SEED_SA_PASSWORD, SEED_SA_NAME env vars
 */
export async function seedSuperAdmin(opts?: {
  email?: string;
  password?: string;
  name?: string;
}) {
  const email = (opts?.email ?? process.env.SEED_SA_EMAIL ?? "sa@adjudicarts.dev").toLowerCase();
  const password = opts?.password ?? process.env.SEED_SA_PASSWORD ?? "password123";
  const name = opts?.name ?? process.env.SEED_SA_NAME ?? "Platform Admin";

  if (password === "password123" && process.env.NODE_ENV === "production") {
    throw new Error("SEED_SA_PASSWORD must be set for production super-admin seeding");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const sa = await prisma.superAdmin.upsert({
    where: { email },
    update: { name, passwordHash },
    create: {
      id: `sa-${crypto.randomBytes(6).toString("hex")}`,
      email,
      name,
      passwordHash,
    },
  });

  console.log(`✓ SuperAdmin: ${sa.name} <${sa.email}>`);
  return sa;
}

async function runSeed(seedFn: () => Promise<void>) {
  try {
    await seedFn();
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectSeedExecution =
  process.argv[1]?.endsWith("/prisma/seed.ts") ||
  process.argv[1]?.endsWith("\\prisma\\seed.ts");

if (isDirectSeedExecution) {
  runSeed(seedDevelopment);
}
