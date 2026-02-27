type ApplicationMetadata = {
  voicePart?: string;
  videoUrls?: string[];
  citizenshipDocumentUrl?: string | null;
  resourceUrls?: string[];
  intakeHeadshotUrl?: string | null;
};

type ParsedApplicationMetadata = {
  voicePart: string | null;
  videoUrls: string[];
  citizenshipDocumentUrl: string | null;
  resourceUrls: string[];
  intakeHeadshotUrl: string | null;
};

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function normalizeUrlList(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeUrl(item))
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
      citizenshipDocumentUrl: null,
      resourceUrls: [] as string[],
      intakeHeadshotUrl: null,
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
      const citizenshipDocumentUrl = normalizeUrl(parsed.citizenshipDocumentUrl);
      const resourceUrls = normalizeUrlList(parsed.resourceUrls, 8);
      const intakeHeadshotUrl = normalizeUrl(parsed.intakeHeadshotUrl);
      return {
        voicePart,
        videoUrls,
        citizenshipDocumentUrl,
        resourceUrls,
        intakeHeadshotUrl,
      } satisfies ParsedApplicationMetadata;
    }
  } catch {
    // Legacy format: plain voice part string.
  }

  return {
    voicePart: notes,
    videoUrls: [] as string[],
    citizenshipDocumentUrl: null,
    resourceUrls: [] as string[],
    intakeHeadshotUrl: null,
  } satisfies ParsedApplicationMetadata;
}

export function buildApplicationMetadata(metadata: ApplicationMetadata) {
  return JSON.stringify({
    voicePart: metadata.voicePart ?? null,
    videoUrls: (metadata.videoUrls ?? []).filter((url) => url.length > 0).slice(0, 3),
    citizenshipDocumentUrl: normalizeUrl(metadata.citizenshipDocumentUrl) ?? null,
    resourceUrls: (metadata.resourceUrls ?? [])
      .map((url) => normalizeUrl(url))
      .filter((url): url is string => Boolean(url))
      .slice(0, 8),
    intakeHeadshotUrl: normalizeUrl(metadata.intakeHeadshotUrl) ?? null,
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
