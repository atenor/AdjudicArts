import { put } from "@vercel/blob";
import { toPrivateBlobRef } from "@/lib/blob-refs";
import { buildOptimizedDisplayJpeg, toStoredJpegFilename } from "@/lib/heic";

const ALLOWED_FIELDS = new Set(["headshot", "citizenship-proof"]);
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function sanitizeFilename(filename: string) {
  const trimmed = filename.trim().toLowerCase();
  const normalized = trimmed.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^-|-$/g, "") || "upload";
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const field = searchParams.get("field")?.trim() ?? "";
  const eventId = searchParams.get("eventId")?.trim() ?? "";

  if (!ALLOWED_FIELDS.has(field)) {
    return Response.json({ error: "Invalid upload field" }, { status: 400 });
  }

  if (!eventId) {
    return Response.json({ error: "Missing event id" }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return Response.json(
      { error: "Upload must be a JPG, PNG, WEBP, HEIC, or HEIF image" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Response.json(
      { error: "Image uploads must be 10MB or smaller" },
      { status: 400 }
    );
  }

  try {
    const originalName = sanitizeFilename(file.name);
    const uploadName = toStoredJpegFilename(originalName);
    const pathname = `applications/${eventId}/${field}/${Date.now()}-${uploadName}`;
    const uploadBody = await buildOptimizedDisplayJpeg({
      buffer: await file.arrayBuffer(),
      sourceName: file.name,
      contentType: file.type,
      maxDimension: field === "headshot" ? 1600 : 1800,
      quality: field === "headshot" ? 0.8 : 0.82,
    });
    const contentType = "image/jpeg";

    const blob = await put(pathname, uploadBody, {
      access: "private",
      addRandomSuffix: true,
      contentType,
    });

    return Response.json({
      url: toPrivateBlobRef(blob.pathname),
      pathname: blob.pathname,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Upload failed. Check blob storage configuration.",
      },
      { status: 500 }
    );
  }
}
