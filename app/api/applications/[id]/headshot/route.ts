import { get } from "@vercel/blob";
import { getApplicationDocumentRefsById } from "@/lib/db/applications";
import { getPrivateBlobPathname, isPrivateBlobRef } from "@/lib/blob-refs";
import { parseApplicationMetadata } from "@/lib/application-metadata";
import { convertHeicBufferToJpeg, isHeicLike, toJpegFilename } from "@/lib/heic";

export const dynamic = "force-dynamic";

function extractDriveId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const byQuery = parsed.searchParams.get("id");
    if (byQuery) return byQuery;
    return parsed.pathname.match(/\/d\/([^/]+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function toGoogleusercontentHeadshotUrl(url: string) {
  const id = extractDriveId(url);
  if (!id) return null;
  return `https://lh3.googleusercontent.com/d/${id}=w1600`;
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
    const filename = sourceName ? toJpegFilename(sourceName.split("/").pop() ?? "image.heic") : "image.jpg";
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
  const application = await getApplicationDocumentRefsById(params.id);
  const metadata = parseApplicationMetadata(application?.notes ?? null);
  const headshotRef = application?.headshot ?? metadata.intakeHeadshotUrl;

  if (!headshotRef) {
    return new Response("Not found", { status: 404 });
  }

  if (!isPrivateBlobRef(headshotRef)) {
    const externalUrls = [headshotRef];
    const googleusercontent = toGoogleusercontentHeadshotUrl(headshotRef);
    if (googleusercontent && googleusercontent !== headshotRef) {
      externalUrls.unshift(googleusercontent);
    }

    for (const externalUrl of externalUrls) {
      const response = await fetch(externalUrl);
      if (!response.ok || !response.body) continue;
      return buildInlineResponse(response.body, response.headers, externalUrl);
    }

    return new Response("Not found", { status: 404 });
  }

  const pathname = getPrivateBlobPathname(headshotRef);
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
