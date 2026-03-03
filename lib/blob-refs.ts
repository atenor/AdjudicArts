const PRIVATE_BLOB_PREFIX = "blob:private:";

export function toPrivateBlobRef(pathname: string) {
  const trimmed = pathname.trim();
  return `${PRIVATE_BLOB_PREFIX}${trimmed}`;
}

export function isPrivateBlobRef(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith(PRIVATE_BLOB_PREFIX);
}

export function getPrivateBlobPathname(value: string | null | undefined) {
  if (!isPrivateBlobRef(value)) return null;
  const pathname = (value ?? "").slice(PRIVATE_BLOB_PREFIX.length).trim();
  return pathname.length > 0 ? pathname : null;
}

export function normalizeStoredAssetRef(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isPrivateBlobRef(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

export function getPrivateBlobHeadshotUrl(applicationId: string) {
  return `/api/applications/${applicationId}/headshot`;
}

export function getPrivateBlobCitizenshipDocumentUrl(applicationId: string) {
  return `/api/applications/${applicationId}/citizenship-document`;
}
