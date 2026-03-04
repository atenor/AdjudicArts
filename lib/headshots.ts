import { getPrivateBlobHeadshotUrl, isPrivateBlobRef } from "@/lib/blob-refs";

const FALLBACK_HEADSHOTS = [
  "/headshots/sample-aria-1.jpg",
  "/headshots/sample-aria-2.jpg",
  "/headshots/sample-aria-3.jpg",
  "/headshots/sample-aria-4.jpg",
  "/headshots/sample-aria-5.jpg",
] as const;

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
  // Route all stored headshots through our API endpoint so legacy Drive links
  // and private blob refs render consistently across browsers.
  if (isPrivateBlobRef(headshot)) {
    return getPrivateBlobHeadshotUrl(seed);
  }
  return getPrivateBlobHeadshotUrl(seed);
}
