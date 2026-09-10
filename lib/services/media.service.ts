import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaUploads } from "@/db/schema";

export interface StoredMedia {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

async function ensureUploadsDir() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Optimizes an uploaded image using Sharp and saves it persistently
 * to both the PostgreSQL Neon database (media_uploads table) and the
 * local public/uploads directory when writable.
 */
export async function processAndSaveImage(
  inputBuffer: Buffer,
  originalFilename: string,
): Promise<StoredMedia> {
  const id = crypto.randomUUID();
  const cleanBase = path
    .basename(originalFilename)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.[^/.]+$/, "");
  const filename = `${cleanBase || "image"}.webp`;

  // Process with Sharp: auto-orient, clamp dimensions to 1600x1600, compress to WebP
  const optimizedBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  const base64Data = optimizedBuffer.toString("base64");
  const sizeBytes = optimizedBuffer.length;

  // 1. Cache to local filesystem if possible
  const dirReady = await ensureUploadsDir();
  if (dirReady) {
    try {
      const diskPath = path.join(UPLOADS_DIR, `${id}.webp`);
      await fs.writeFile(diskPath, optimizedBuffer);
    } catch (diskErr) {
      console.warn("[MediaService] Could not write to disk cache:", diskErr);
    }
  }

  // 2. Persist to Neon Postgres so it survives restarts, deployments, and serverless environments
  if (db) {
    await db.insert(mediaUploads).values({
      id,
      filename,
      mimeType: "image/webp",
      sizeBytes,
      data: base64Data,
    });
  }

  return {
    id,
    url: `/api/media/${id}`,
    filename,
    mimeType: "image/webp",
    sizeBytes,
  };
}

/**
 * Retrieve an uploaded image by ID. Tries local disk first, then falls back to database.
 */
export async function getMediaById(id: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  filename: string;
} | null> {
  // Clean ID
  const cleanId = id.replace(/\.webp$/i, "").trim();

  // Try local disk cache
  try {
    const diskPath = path.join(UPLOADS_DIR, `${cleanId}.webp`);
    const fileBuf = await fs.readFile(diskPath);
    return {
      buffer: fileBuf,
      mimeType: "image/webp",
      filename: `${cleanId}.webp`,
    };
  } catch {
    // Fall back to database
  }

  if (!db) return null;

  try {
    const [row] = await db
      .select({
        id: mediaUploads.id,
        filename: mediaUploads.filename,
        mimeType: mediaUploads.mimeType,
        data: mediaUploads.data,
      })
      .from(mediaUploads)
      .where(eq(mediaUploads.id, cleanId))
      .limit(1);

    if (!row || !row.data) return null;

    const buffer = Buffer.from(row.data, "base64");

    // Re-cache to disk for next requests if writable
    try {
      const dirReady = await ensureUploadsDir();
      if (dirReady) {
        await fs.writeFile(path.join(UPLOADS_DIR, `${cleanId}.webp`), buffer);
      }
    } catch {
      // Ignore disk caching errors
    }

    return {
      buffer,
      mimeType: row.mimeType || "image/webp",
      filename: row.filename,
    };
  } catch (err) {
    console.error("[MediaService] Failed to retrieve media from db:", err);
    return null;
  }
}
