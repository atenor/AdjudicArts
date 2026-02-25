const FALLBACK_HEADSHOTS = [
  "/headshots/sample-aria-1.jpg",
  "/headshots/sample-aria-2.jpg",
  "/headshots/sample-aria-3.jpg",
  "/headshots/sample-aria-4.jpg",
  "/headshots/sample-aria-5.jpg",
] as const;

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

function toHighResHeadshotUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const driveId = extractDriveId(trimmed);
  if (driveId) {
    return `https://drive.google.com/uc?export=view&id=${driveId}`;
  }

  // Legacy imports stored `thumbnail?...&sz=w400`; bump to a larger render size.
  if (trimmed.includes("drive.google.com/thumbnail")) {
    try {
      const parsed = new URL(trimmed);
      const id = parsed.searchParams.get("id");
      if (id) {
        return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
      }
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

export function getFallbackHeadshot(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return FALLBACK_HEADSHOTS[Math.abs(hash) % FALLBACK_HEADSHOTS.length];
}

export function getDisplayHeadshot(headshot: string | null | undefined, seed: string) {
  if (!headshot || headshot.trim().length === 0) {
    return getFallbackHeadshot(seed);
  }
  return toHighResHeadshotUrl(headshot);
}
