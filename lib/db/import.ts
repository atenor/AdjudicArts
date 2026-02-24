import { ApplicationStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { buildApplicationMetadata } from "@/lib/application-metadata";

type CsvRow = Record<string, string>;

type ImportResult = {
  email: string;
  applicantName: string;
  createdUser: boolean;
  createdApplication: boolean;
  updatedApplication: boolean;
};

const playlistCache = new Map<string, string[]>();

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getValue(row: CsvRow, keys: string[]): string | null {
  const entries = Object.entries(row);
  for (const key of keys) {
    const direct = clean(row[key]);
    if (direct) return direct;
  }

  for (const [existingKey, value] of entries) {
    const normalized = existingKey.toLowerCase();
    if (keys.some((key) => normalized.includes(key.toLowerCase()))) {
      const cleaned = clean(value);
      if (cleaned) return cleaned;
    }
  }

  return null;
}

function normalizeVoicePart(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const map: Record<string, string> = {
    soprano: "soprano",
    mezzo: "mezzo",
    "mezzo-soprano": "mezzo",
    tenor: "tenor",
    baritone: "baritone",
    bass: "bass",
  };

  return map[normalized] ?? normalized;
}

function compactCsvProfile(row: CsvRow) {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => clean(value) !== null)
  );
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const parts = value.split("/").map((part) => Number(part));
  if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
    const [month, day, year] = parts;
    const alt = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(alt.getTime())) return alt;
  }

  return null;
}

function extractDriveId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const byQuery = parsed.searchParams.get("id");
    if (byQuery) return byQuery;

    const byPath = parsed.pathname.match(/\/d\/([^/]+)/)?.[1] ?? null;
    return byPath;
  } catch {
    return null;
  }
}

function toDriveThumbnail(url: string | null): string | null {
  if (!url) return null;
  const id = extractDriveId(url);
  if (!id) return null;
  return `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
}

function extractPlaylistId(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const playlistId = parsed.searchParams.get("list");
    return clean(playlistId);
  } catch {
    return null;
  }
}

async function resolvePlaylistVideoUrls(playlistUrl: string | null): Promise<string[]> {
  const playlistId = extractPlaylistId(playlistUrl);
  if (!playlistId) return [];

  if (playlistCache.has(playlistId)) {
    return playlistCache.get(playlistId) ?? [];
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    playlistCache.set(playlistId, []);
    return [];
  }

  const endpoint = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  endpoint.searchParams.set("part", "contentDetails");
  endpoint.searchParams.set("maxResults", "3");
  endpoint.searchParams.set("playlistId", playlistId);
  endpoint.searchParams.set("key", apiKey);

  try {
    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      playlistCache.set(playlistId, []);
      return [];
    }

    const data = (await response.json()) as {
      items?: Array<{ contentDetails?: { videoId?: string } }>;
    };

    const urls = (data.items ?? [])
      .map((item) => item.contentDetails?.videoId)
      .filter((videoId): videoId is string => Boolean(videoId))
      .slice(0, 3)
      .map((videoId) => `https://www.youtube.com/watch?v=${videoId}`);

    playlistCache.set(playlistId, urls);
    return urls;
  } catch {
    playlistCache.set(playlistId, []);
    return [];
  }
}

export function parseApplicantCsv(csvText: string): CsvRow[] {
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
    relax_column_count: true,
  }) as CsvRow[];

  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()])
    )
  );
}

export function getApplicantPreview(rows: CsvRow[], limit = 5) {
  return rows.slice(0, limit).map((row) => ({
    firstName: getValue(row, ["First Name"]) ?? "",
    lastName: getValue(row, ["Last Name"]) ?? "",
    email: getValue(row, ["Email Address"]) ?? "",
    chapter: getValue(row, ["Choose Your Chapter", "Chapter"]) ?? "",
    playlist: getValue(row, ["YouTube Playlist Link"]) ?? "",
  }));
}

export async function getImportableEvents(organizationId: string) {
  return prisma.event.findMany({
    where: { organizationId },
    select: { id: true, name: true, status: true, openAt: true, closeAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getImportEventById(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizationId: true, name: true, status: true },
  });
}

export async function purgeEventApplications(eventId: string, organizationId: string) {
  const applications = await prisma.application.findMany({
    where: { eventId, organizationId },
    select: { id: true, applicantId: true },
  });

  const applicationIds = applications.map((application) => application.id);
  if (applicationIds.length === 0) {
    return { deletedApplications: 0, deletedScores: 0, deletedApplicants: 0 };
  }

  const result = await prisma.$transaction(async (tx) => {
    const deletedScores = await tx.score.deleteMany({
      where: {
        organizationId,
        applicationId: { in: applicationIds },
      },
    });

    const deletedApplications = await tx.application.deleteMany({
      where: {
        organizationId,
        id: { in: applicationIds },
      },
    });

    const applicantIds = Array.from(
      new Set(applications.map((application) => application.applicantId))
    );

    let deletedApplicants = 0;
    for (const applicantId of applicantIds) {
      const remainingCount = await tx.application.count({
        where: { organizationId, applicantId },
      });

      if (remainingCount > 0) continue;

      const deleted = await tx.user.deleteMany({
        where: {
          id: applicantId,
          organizationId,
          role: Role.APPLICANT,
        },
      });
      deletedApplicants += deleted.count;
    }

    return {
      deletedApplications: deletedApplications.count,
      deletedScores: deletedScores.count,
      deletedApplicants,
    };
  });

  return result;
}

export async function importApplicantFromRow(
  row: CsvRow,
  eventId: string,
  organizationId: string
): Promise<ImportResult> {
  const firstName = getValue(row, ["First Name"]) ?? "";
  const lastName = getValue(row, ["Last Name"]) ?? "";
  const email = (getValue(row, ["Email Address"]) ?? "").toLowerCase();

  if (!email) {
    throw new Error("Missing email address");
  }

  const applicantName = `${firstName} ${lastName}`.trim() || email;

  let user = await prisma.user.findUnique({ where: { email } });
  let createdUser = false;

  if (!user) {
    const passwordHash = await bcrypt.hash(randomUUID(), 12);
    user = await prisma.user.create({
      data: {
        organizationId,
        email,
        name: applicantName,
        role: Role.APPLICANT,
        passwordHash,
      },
    });
    createdUser = true;
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: applicantName,
      },
    });
  }

  const chapter = getValue(row, ["Choose Your Chapter", "Chapter"]);
  const dateOfBirth = parseDate(getValue(row, ["Date of Birth", "DOB", "Birth Date"]));
  const gender = getValue(row, ["Gender", "Pronouns"]);
  const phone = getValue(row, ["Phone", "Phone Number"]);
  const address = getValue(row, ["Street Address", "Address"]);
  const city = getValue(row, ["City"]);
  const state = getValue(row, ["State", "Province"]);
  const zip = getValue(row, ["Zip", "Postal Code"]);
  const voicePart = normalizeVoicePart(
    getValue(row, ["Voice Part", "Voice Type", "Division", "Category", "Part"])
  );
  const schoolName = getValue(row, ["School Name (If Applicable)"]);
  const schoolCity = getValue(row, ["School City (If Applicable)"]);
  const schoolState = getValue(row, ["School State (If Applicable)"]);
  const highSchoolName = getValue(row, ["High School Name"]);
  const collegeName = getValue(row, ["If Yes - College/University Name", "College Name"]);
  const major = getValue(row, ["If in College: What is your major?", "Major"]);
  const careerPlans = getValue(row, ["Tell Us About Your Future Career Plans"]);
  const scholarshipUse = getValue(row, ["how do you plan to use the funds"]);
  const video1Title = getValue(row, ["Video #1: Title and Composer", "Video 1 Title"]);
  const video2Title = getValue(row, ["Video #2: Title and Composer", "Video 2 Title"]);
  const video3Title = getValue(row, ["Video #3: Title and Composer", "Video 3 Title"]);
  const youtubePlaylist = getValue(row, ["YouTube Playlist Link"]);
  const explicitVideo1Url = getValue(row, ["Video 1 URL", "Video #1 URL"]);
  const explicitVideo2Url = getValue(row, ["Video 2 URL", "Video #2 URL"]);
  const explicitVideo3Url = getValue(row, ["Video 3 URL", "Video #3 URL"]);
  const headshot = toDriveThumbnail(
    getValue(row, ["High-Quality Headshot", "Performance Photograph"])
  );
  const bio = getValue(row, ["150–200 Word Bio", "150-200 Word Bio"]);
  const parentName = getValue(row, ["Parent/Guardian Name"]);
  const parentEmail = getValue(row, ["Parent/Guardian Email"]);

  const resolvedVideoUrls = await resolvePlaylistVideoUrls(youtubePlaylist);
  const mergedVideoUrls = [explicitVideo1Url, explicitVideo2Url, explicitVideo3Url]
    .map((url) => clean(url))
    .filter((url): url is string => Boolean(url));
  if (mergedVideoUrls.length === 0) {
    mergedVideoUrls.push(...resolvedVideoUrls);
  }
  const [video1Url, video2Url, video3Url] = mergedVideoUrls;

  const repertoireFromVideos = [video1Title, video2Title, video3Title]
    .filter((title): title is string => Boolean(title))
    .join("\n");
  const repertoire =
    clean(
      getValue(row, ["Repertoire", "Program", "Song List", "Pieces", "Titles"])
    ) ?? clean(repertoireFromVideos);

  const metadataSeed = JSON.parse(
    buildApplicationMetadata({
      voicePart: voicePart ?? undefined,
      videoUrls: [video1Url, video2Url, video3Url].filter(
        (url): url is string => Boolean(url)
      ),
    })
  ) as Record<string, unknown>;
  const notes = JSON.stringify({
    ...metadataSeed,
    importProfile: {
      chapter,
      applicantName,
      parentName,
      parentEmail,
      rawCsv: compactCsvProfile(row),
    },
  });

  const applicationData = {
    organizationId,
    eventId,
    applicantId: user.id,
    chapter,
    dateOfBirth,
    gender,
    phone,
    address,
    city,
    state,
    zip,
    schoolName,
    schoolCity,
    schoolState,
    highSchoolName,
    collegeName,
    major,
    careerPlans,
    scholarshipUse,
    video1Title,
    video2Title,
    video3Title,
    video1Url: clean(video1Url),
    video2Url: clean(video2Url),
    video3Url: clean(video3Url),
    youtubePlaylist,
    headshot,
    bio,
    parentName,
    parentEmail,
    repertoire,
    notes,
  };

  const existingApplication = await prisma.application.findFirst({
    where: {
      eventId,
      applicantId: user.id,
      organizationId,
    },
    select: { id: true },
  });

  let createdApplication = false;
  let updatedApplication = false;

  if (existingApplication) {
    await prisma.application.update({
      where: { id: existingApplication.id },
      data: applicationData,
    });
    updatedApplication = true;
  } else {
    await prisma.application.create({
      data: {
        ...applicationData,
        status: ApplicationStatus.SUBMITTED,
      },
    });
    createdApplication = true;
  }

  return {
    email,
    applicantName,
    createdUser,
    createdApplication,
    updatedApplication,
  };
}

export async function importApplicantsFromRows(input: {
  rows: CsvRow[];
  eventId: string;
  organizationId: string;
}) {
  const errors: Array<{ row: number; email?: string; message: string }> = [];
  let imported = 0;
  let createdUsers = 0;
  let createdApplications = 0;
  let updatedApplications = 0;

  for (let index = 0; index < input.rows.length; index += 1) {
    const row = input.rows[index];

    try {
      const result = await importApplicantFromRow(
        row,
        input.eventId,
        input.organizationId
      );

      imported += 1;
      if (result.createdUser) createdUsers += 1;
      if (result.createdApplication) createdApplications += 1;
      if (result.updatedApplication) updatedApplications += 1;
    } catch (error) {
      const email = clean(
        getValue(row, ["Email Address", "email"])
      ) ?? undefined;
      errors.push({
        row: index + 2,
        email,
        message: error instanceof Error ? error.message : "Unknown import error",
      });
    }
  }

  return {
    totalRows: input.rows.length,
    imported,
    createdUsers,
    createdApplications,
    updatedApplications,
    errors,
  };
}
