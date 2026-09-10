import { NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/lib/auth/authorize";
import { processAndSaveImage, StoredMedia } from "@/lib/services/media.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
]);

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

export async function POST(request: NextRequest) {
  try {
    const session = await authorizeStaff(["admin", "staff"]);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized. Staff login is required." },
        { status: 401 },
      );
    }

    const formData = await request.formData();

    // Check for multiple files or single file
    const files: File[] = [];
    const allFiles = formData.getAll("files");
    if (allFiles.length > 0) {
      for (const item of allFiles) {
        if (item instanceof File && item.size > 0) files.push(item);
      }
    }
    const singleFile = formData.get("file");
    if (singleFile instanceof File && singleFile.size > 0) {
      if (!files.includes(singleFile)) files.push(singleFile);
    }

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No image files provided in upload." },
        { status: 400 },
      );
    }

    const results: StoredMedia[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            ok: false,
            error: `File "${file.name}" exceeds maximum allowed size of 15MB.`,
          },
          { status: 400 },
        );
      }

      if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
        return NextResponse.json(
          {
            ok: false,
            error: `File "${file.name}" has unsupported type (${file.type}). Allowed types: JPG, PNG, WEBP, GIF, AVIF.`,
          },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const saved = await processAndSaveImage(buffer, file.name);
      results.push(saved);
    }

    return NextResponse.json({
      ok: true,
      url: results[0].url,
      media: results[0],
      results,
    });
  } catch (error) {
    console.error("[Upload API Error]", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Image upload failed. Please try again.",
      },
      { status: 500 },
    );
  }
}
