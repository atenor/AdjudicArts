import { normalizeStoredAssetRef } from "@/lib/blob-refs";

type ApplicationMetadata = {
  voicePart?: string;
  videoUrls?: string[];
  citizenshipStatus?: string | null;
  citizenshipDocumentUrl?: string | null;
  resourceUrls?: string[];
  intakeHeadshotUrl?: string | null;
  mediaReleaseAccepted?: boolean;
  privacyPolicyAccepted?: boolean;
  submissionTermsAccepted?: boolean;
};

type ParsedApplicationMetadata = {
  voicePart: string | null;
  videoUrls: string[];
  citizenshipStatus: string | null;
  citizenshipDocumentUrl: string | null;
  resourceUrls: string[];
  intakeHeadshotUrl: string | null;
  mediaReleaseAccepted: boolean;
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
      privacyPolicyAccepted: false,
      submissionTermsAccepted: false,
    } satisfies ParsedApplicationMetadata;
  }

  try {
    const parsed = JSON.parse(notes) as unknown;
    if (isObject(parsed)) {
      const voicePart =
        typeof parsed.voicePart === "string" && parsed.voicePart.length > 0
          ? parsed.voicePart
          : null;
      const videoUrls = normalizeUrlList(parsed.videoUrls, 3);
      const citizenshipStatus =
        typeof parsed.citizenshipStatus === "string" && parsed.citizenshipStatus.length > 0
          ? parsed.citizenshipStatus
          : null;
      const citizenshipDocumentUrl = normalizeStoredAssetRef(parsed.citizenshipDocumentUrl);
      const resourceUrls = normalizeUrlList(parsed.resourceUrls, 8);
      const intakeHeadshotUrl = normalizeStoredAssetRef(parsed.intakeHeadshotUrl);
      const mediaReleaseAccepted = parsed.mediaReleaseAccepted === true;
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
