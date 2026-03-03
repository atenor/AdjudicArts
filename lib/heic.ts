import convert from "heic-convert";
import sharp from "sharp";

const HEIC_CONTENT_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXTENSION_RE = /\.(heic|heif)(\?|$)/i;

export function isHeicLike(sourceName?: string | null, contentType?: string | null) {
  const normalizedContentType = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (HEIC_CONTENT_TYPES.has(normalizedContentType)) return true;
  return typeof sourceName === "string" && HEIC_EXTENSION_RE.test(sourceName);
}

export function toJpegFilename(filename: string) {
  return filename.replace(/\.(heic|heif)$/i, ".jpg");
}

export function toStoredJpegFilename(filename: string) {
  const trimmed = filename.trim();
  const withJpegExtension = trimmed.replace(/\.[a-z0-9]+$/i, ".jpg");
  return withJpegExtension.endsWith(".jpg") ? withJpegExtension : `${withJpegExtension}.jpg`;
}

export async function convertHeicBufferToJpeg(
  input: Buffer | Uint8Array | ArrayBuffer,
  quality = 0.92
) {
  const buffer =
    input instanceof ArrayBuffer ? Buffer.from(input) : Buffer.from(input);
  const output = await convert({
    buffer,
    format: "JPEG",
    quality,
  });

  return output instanceof ArrayBuffer
    ? Buffer.from(new Uint8Array(output))
    : Buffer.from(output);
}

export async function buildOptimizedDisplayJpeg(input: {
  buffer: Buffer | Uint8Array | ArrayBuffer;
  sourceName?: string | null;
  contentType?: string | null;
  maxDimension?: number;
  quality?: number;
}) {
  const sourceBuffer =
    input.buffer instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(input.buffer))
      : Buffer.from(input.buffer);

  const normalizedSource = isHeicLike(input.sourceName, input.contentType)
    ? await convertHeicBufferToJpeg(sourceBuffer, 0.95)
    : sourceBuffer;

  const optimizedBuffer = await sharp(normalizedSource)
    .rotate()
    .resize({
      width: input.maxDimension ?? 1800,
      height: input.maxDimension ?? 1800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: Math.round((input.quality ?? 0.82) * 100),
      mozjpeg: true,
    })
    .toBuffer();

  return optimizedBuffer;
}
