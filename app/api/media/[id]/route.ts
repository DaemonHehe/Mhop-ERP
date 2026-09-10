import { NextRequest, NextResponse } from "next/server";
import { getMediaById } from "@/lib/services/media.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing media ID" }, { status: 400 });
    }

    const media = await getMediaById(id);
    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    // Check ETag for 304 Not Modified
    const etag = `"${id.replace(/[^a-zA-Z0-9]/g, "")}-${media.buffer.length}"`;
    const clientEtag = request.headers.get("if-none-match");
    if (clientEtag && clientEtag === etag) {
      return new NextResponse(null, { status: 304 });
    }

    return new NextResponse(new Uint8Array(media.buffer), {
      status: 200,
      headers: {
        "Content-Type": media.mimeType || "image/webp",
        "Content-Length": String(media.buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  } catch (error) {
    console.error("[Media Route Error]", error);
    return NextResponse.json({ error: "Failed to load media" }, { status: 500 });
  }
}
