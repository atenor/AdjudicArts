import { normalizeStoredAssetRef } from "@/lib/blob-refs";

type ApplicationMetadata = {
  voicePart?: string;
  videoUrls?: string[];
  citizenshipStatus?: string | null;
  citizenshipDocumentUrl?: string | null;
  resourceUrls?: string[];
  intakeHeadshotUrl?: string | null;
  mediaReleaseAccepted?: boolean;
  dateOfBirthCertified?: boolean;
  hasPriorFirstPrize?: boolean;
  priorFirstPrizeDivision?: string | null;
  privacyPolicyAccepted?: boolean;
  submissionTermsAccepted?: boolean;
};

type RawCsvRecord = Record<string, string>;

type ParsedApplicationMetadata = {
  voicePart: string | null;
  videoUrls: string[];
  citizenshipStatus: string | null;
  citizenshipDocumentUrl: string | null;
  resourceUrls: string[];
  intakeHeadshotUrl: string | null;
  mediaReleaseAccepted: boolean;
  dateOfBirthCertified: boolean;
  hasPriorFirstPrize: boolean | null;
  priorFirstPrizeDivision: string | null;
  privacyPolicyAccepted: boolean;
  submissionTermsAccepted: boolean;
};

function normalizeUrlList(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeStoredAssetRef(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, max);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeExternalUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function extractFirstUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/https?:\/\/[^\s)]+/i);
  return match?.[0] ?? null;
}

function findImportedUrl(
  rawCsv: RawCsvRecord | null | undefined,
  keySignals: string[]
) {
  if (!rawCsv) return null;

  for (const [key, value] of Object.entries(rawCsv)) {
    const normalizedKey = key.toLowerCase();
    if (!keySignals.some((signal) => normalizedKey.includes(signal))) continue;

    const directUrl = normalizeExternalUrl(value);
    if (directUrl) return directUrl;

    const embeddedUrl = extractFirstUrl(value);
    if (embeddedUrl) return embeddedUrl;
  }

  return null;
}

export function parseApplicationMetadata(notes: string | null | undefined) {
  if (!notes) {
    return {
      voicePart: null,
      videoUrls: [] as string[],
      citizenshipStatus: null,
      citizenshipDocumentUrl: null,
      resourceUrls: [] as string[],
      intakeHeadshotUrl: null,
      mediaReleaseAccepted: false,
      dateOfBirthCertified: false,
      hasPriorFirstPrize: null,
      priorFirstPrizeDivision: null,
      privacyPolicyAccepted: false,
      submissionTermsAccepted: false,
    } satisfies ParsedApplicationMetadata;
  }

  try {
    const parsed = JSON.parse(notes) as unknown;
    if (isObject(parsed)) {
      const importProfile = isObject(parsed.importProfile) ? parsed.importProfile : null;
      const rawCsv = isObject(importProfile?.rawCsv)
        ? (importProfile.rawCsv as RawCsvRecord)
        : null;
      const voicePart =
        typeof parsed.voicePart === "string" && parsed.voicePart.length > 0
          ? parsed.voicePart
          : null;
      const videoUrls = normalizeUrlList(parsed.videoUrls, 3);
      const citizenshipStatus =
        typeof parsed.citizenshipStatus === "string" && parsed.citizenshipStatus.length > 0
          ? parsed.citizenshipStatus
          : null;
      const citizenshipDocumentUrl =
        normalizeStoredAssetRef(parsed.citizenshipDocumentUrl) ??
        findImportedUrl(rawCsv, [
          "proof of u.s. citizenship",
          "proof of citizenship",
          "citizenship document",
          "passport",
          "resident",
          "green card",
        ]);
      const resourceUrls = normalizeUrlList(parsed.resourceUrls, 8);
      const intakeHeadshotUrl =
        normalizeStoredAssetRef(parsed.intakeHeadshotUrl) ??
        findImportedUrl(rawCsv, ["headshot", "performance photograph", "photo"]);
      const mediaReleaseAccepted = parsed.mediaReleaseAccepted === true;
      const dateOfBirthCertified = parsed.dateOfBirthCertified === true;
      const hasPriorFirstPrize =
        typeof parsed.hasPriorFirstPrize === "boolean" ? parsed.hasPriorFirstPrize : null;
      const priorFirstPrizeDivision =
        typeof parsed.priorFirstPrizeDivision === "string" &&
        parsed.priorFirstPrizeDivision.trim().length > 0
          ? parsed.priorFirstPrizeDivision.trim()
          : null;
      const privacyPolicyAccepted = parsed.privacyPolicyAccepted === true;
      const submissionTermsAccepted = parsed.submissionTermsAccepted === true;
      return {
        voicePart,
        videoUrls,
        citizenshipStatus,
        citizenshipDocumentUrl,
        resourceUrls,
        intakeHeadshotUrl,
        mediaReleaseAccepted,
        dateOfBirthCertified,
        hasPriorFirstPrize,
        priorFirstPrizeDivision,
        privacyPolicyAccepted,
        submissionTermsAccepted,
      } satisfies ParsedApplicationMetadata;
    }
  } catch {
    // Legacy format: plain voice part string.
  }

  return {
    voicePart: notes,
    videoUrls: [] as string[],
    citizenshipStatus: null,
    citizenshipDocumentUrl: null,
    resourceUrls: [] as string[],
    intakeHeadshotUrl: null,
    mediaReleaseAccepted: false,
    dateOfBirthCertified: false,
    hasPriorFirstPrize: null,
    priorFirstPrizeDivision: null,
    privacyPolicyAccepted: false,
    submissionTermsAccepted: false,
  } satisfies ParsedApplicationMetadata;
}

export function buildApplicationMetadata(metadata: ApplicationMetadata) {
  return JSON.stringify({
    voicePart: metadata.voicePart ?? null,
    videoUrls: (metadata.videoUrls ?? []).filter((url) => url.length > 0).slice(0, 3),
    citizenshipStatus: metadata.citizenshipStatus ?? null,
    citizenshipDocumentUrl: normalizeStoredAssetRef(metadata.citizenshipDocumentUrl) ?? null,
    resourceUrls: (metadata.resourceUrls ?? [])
      .map((url) => normalizeStoredAssetRef(url))
      .filter((url): url is string => Boolean(url))
      .slice(0, 8),
    intakeHeadshotUrl: normalizeStoredAssetRef(metadata.intakeHeadshotUrl) ?? null,
    mediaReleaseAccepted: metadata.mediaReleaseAccepted === true,
    dateOfBirthCertified: metadata.dateOfBirthCertified === true,
    hasPriorFirstPrize:
      typeof metadata.hasPriorFirstPrize === "boolean" ? metadata.hasPriorFirstPrize : null,
    priorFirstPrizeDivision: metadata.priorFirstPrizeDivision ?? null,
    privacyPolicyAccepted: metadata.privacyPolicyAccepted === true,
    submissionTermsAccepted: metadata.submissionTermsAccepted === true,
  });
}

export function extractVoicePart(notes: string | null | undefined) {
  return parseApplicationMetadata(notes).voicePart;
}

export function formatVoicePart(notes: string | null | undefined) {
  const voicePart = extractVoicePart(notes);
  if (!voicePart) return "—";
  return voicePart.charAt(0).toUpperCase() + voicePart.slice(1);
}
