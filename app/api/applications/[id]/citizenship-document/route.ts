import { get } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getApplicationById,
  getApplicationDocumentRefsById,
} from "@/lib/db/applications";
import { parseApplicationMetadata } from "@/lib/application-metadata";
import { getPrivateBlobPathname, isPrivateBlobRef } from "@/lib/blob-refs";
import { convertHeicBufferToJpeg, isHeicLike, toJpegFilename } from "@/lib/heic";

export const dynamic = "force-dynamic";

type RawCsv = Record<string, string>;

function getImportedRawCsv(notes: string | null | undefined): RawCsv | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as {
      importProfile?: {
        rawCsv?: RawCsv;
      };
    };
    return parsed.importProfile?.rawCsv ?? null;
  } catch {
    return null;
  }
}

function normalizeExternalUrl(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function extractFirstUrl(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s)]+/i);
  return match?.[0] ?? null;
}

function findCitizenshipDocumentUrl(raw: RawCsv | null) {
  if (!raw) return null;
  const entries = Object.entries(raw);
  const targetKeyParts = [
    "citizenship",
    "passport",
    "resident",
    "green card",
    "proof",
    "document",
    "upload",
    "attachment",
    "file",
    "link",
    "url",
  ];

  for (const [key, value] of entries) {
    const normalizedKey = key.toLowerCase();
    const isLikelyCitizenshipKey =
      (normalizedKey.includes("citizen") ||
        normalizedKey.includes("passport") ||
        normalizedKey.includes("resident")) &&
      targetKeyParts.some((part) => normalizedKey.includes(part));

    if (!isLikelyCitizenshipKey) continue;
    const directUrl = normalizeExternalUrl(value);
    if (directUrl && /^https?:\/\//i.test(directUrl)) return directUrl;
    const embeddedUrl = extractFirstUrl(value);
    if (embeddedUrl) return embeddedUrl;
  }

  return null;
}

function extractGoogleDriveId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname !== "drive.google.com") return null;
    const queryId = url.searchParams.get("id");
    if (queryId) return queryId;

    const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/i);
    if (fileMatch?.[1]) return fileMatch[1];

    return null;
  } catch {
    return null;
  }
}

function resolveExternalDocumentUrl(value: string) {
  const driveId = extractGoogleDriveId(value);
  if (driveId) {
    return `https://drive.google.com/uc?export=download&id=${driveId}`;
  }
  return value;
}

async function buildInlineResponse(
  body: ReadableStream<Uint8Array> | Buffer | Uint8Array | ArrayBuffer,
  headersInit: HeadersInit,
  sourceName?: string | null
) {
  const headers = new Headers(headersInit);
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", "private, max-age=600");

  if (isHeicLike(sourceName, headers.get("content-type"))) {
    const sourceBuffer =
      body instanceof ReadableStream
        ? Buffer.from(await new Response(body).arrayBuffer())
        : body instanceof ArrayBuffer
          ? Buffer.from(body)
          : Buffer.from(body);
    const jpegBuffer = await convertHeicBufferToJpeg(sourceBuffer);
    headers.set("Content-Type", "image/jpeg");
    headers.delete("content-length");
    const filename = sourceName ? toJpegFilename(sourceName.split("/").pop() ?? "document.heic") : "document.jpg";
    headers.set("Content-Disposition", `inline; filename="${filename}"`);

    return new Response(jpegBuffer, {
      status: 200,
      headers,
    });
  }

  const responseBody =
    body instanceof ReadableStream
      ? body
      : body instanceof ArrayBuffer
        ? Buffer.from(body)
        : Buffer.from(body);

  return new Response(responseBody, {
    status: 200,
    headers,
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const application = await getApplicationById(params.id, session.user.organizationId, {
    role: session.user.role,
    userChapter: session.user.chapter,
  });
  if (!application) {
    return new Response("Not found", { status: 404 });
  }

  const refs = await getApplicationDocumentRefsById(params.id);
  const rawCsv = getImportedRawCsv(application.notes);
  const metadata = parseApplicationMetadata(refs?.notes ?? application.notes);
  const documentRef =
    metadata.citizenshipDocumentUrl ??
    findCitizenshipDocumentUrl(rawCsv);

  if (!documentRef) {
    return new Response("Not found", { status: 404 });
  }

  if (!isPrivateBlobRef(documentRef)) {
    const response = await fetch(resolveExternalDocumentUrl(documentRef));
    if (!response.ok || !response.body) {
      return new Response("Not found", { status: 404 });
    }
    return buildInlineResponse(response.body, response.headers, documentRef);
  }

  const pathname = getPrivateBlobPathname(documentRef);
  if (!pathname) {
    return new Response("Not found", { status: 404 });
  }

  const result = await get(pathname, {
    access: "private",
    useCache: true,
  });

  if (!result || result.statusCode !== 200) {
    return new Response("Not found", { status: 404 });
  }

  return buildInlineResponse(
    result.stream,
    result.headers as HeadersInit,
    pathname
  );
}
