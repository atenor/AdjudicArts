import { get } from "@vercel/blob";
import { getApplicationDocumentRefsById } from "@/lib/db/applications";
import { getPrivateBlobPathname, isPrivateBlobRef } from "@/lib/blob-refs";
import { convertHeicBufferToJpeg, isHeicLike, toJpegFilename } from "@/lib/heic";

export const dynamic = "force-dynamic";

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
  if (!application?.headshot) {
    return new Response("Not found", { status: 404 });
  }

  if (!isPrivateBlobRef(application.headshot)) {
    const response = await fetch(application.headshot);
    if (!response.ok || !response.body) {
      return new Response("Not found", { status: 404 });
    }
    return buildInlineResponse(response.body, response.headers, application.headshot);
  }

  const pathname = getPrivateBlobPathname(application.headshot);
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
