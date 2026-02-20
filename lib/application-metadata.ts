type ApplicationMetadata = {
  voicePart?: string;
  videoUrls?: string[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseApplicationMetadata(notes: string | null | undefined) {
  if (!notes) {
    return { voicePart: null, videoUrls: [] as string[] };
  }

  try {
    const parsed = JSON.parse(notes) as unknown;
    if (isObject(parsed)) {
      const voicePart =
        typeof parsed.voicePart === "string" && parsed.voicePart.length > 0
          ? parsed.voicePart
          : null;
      const videoUrls = Array.isArray(parsed.videoUrls)
        ? parsed.videoUrls.filter(
            (url): url is string => typeof url === "string" && url.length > 0
          )
        : [];
      return { voicePart, videoUrls };
    }
  } catch {
    // Legacy format: plain voice part string.
  }

  return { voicePart: notes, videoUrls: [] as string[] };
}

export function buildApplicationMetadata(metadata: ApplicationMetadata) {
  return JSON.stringify({
    voicePart: metadata.voicePart ?? null,
    videoUrls: (metadata.videoUrls ?? []).filter((url) => url.length > 0).slice(0, 3),
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
