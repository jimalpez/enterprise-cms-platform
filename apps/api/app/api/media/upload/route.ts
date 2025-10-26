// apps/api/app/api/media/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg"];
const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

interface UploadResponse {
  success: boolean;
  media?: {
    id: string;
    url: string;
    filename: string;
    mimetype: string;
    size: number;
    width?: number;
    height?: number;
  };
  error?: string;
}

// POST /api/media/upload
export async function POST(
  request: NextRequest,
): Promise<NextResponse<UploadResponse>> {
  try {
    // Authentication check using existing JWT auth
    const authHeader = request.headers.get("authorization");
    const user = authenticateRequest(authHeader);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Check if user has permission to upload media
    const canUpload = ["admin", "editor", "author"].includes(user.role);
    if (!canUpload) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Insufficient permissions" },
        { status: 403 },
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
        },
        { status: 400 },
      );
    }

    // Validate file type
    const allowedTypes = [
      ...ALLOWED_IMAGE_TYPES,
      ...ALLOWED_VIDEO_TYPES,
      ...ALLOWED_DOCUMENT_TYPES,
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid file type. Only images, videos, and documents are allowed.",
        },
        { status: 400 },
      );
    }

    // Create upload directory if it doesn't exist
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = file.name.split(".").pop();
    const uniqueId = nanoid(10);
    const filename = `${Date.now()}-${uniqueId}.${fileExtension}`;
    const filepath = join(UPLOAD_DIR, filename);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Write file to disk
    await writeFile(filepath, buffer);

    // Extract dimensions for images
    let width: number | undefined;
    let height: number | undefined;

    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
      try {
        const metadata = await sharp(buffer).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch (error) {
        console.error("Error extracting image metadata:", error);
      }
    }

    // Create media record in database
    const media = await prisma.media.create({
      data: {
        url: `/uploads/${filename}`,
        filename: file.name,
        mimetype: file.type,
        size: file.size,
        width,
        height,
        uploadedBy: user.userId,
      },
    });

    return NextResponse.json({
      success: true,
      media: {
        id: media.id,
        url: media.url,
        filename: media.filename,
        mimetype: media.mimetype,
        size: media.size,
        width: media.width ?? undefined,
        height: media.height ?? undefined,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload file",
      },
      { status: 500 },
    );
  }
}

// GET /api/media/upload
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    maxFileSize: MAX_FILE_SIZE,
    maxFileSizeMB: MAX_FILE_SIZE / 1024 / 1024,
    allowedTypes: {
      images: ALLOWED_IMAGE_TYPES,
      videos: ALLOWED_VIDEO_TYPES,
      documents: ALLOWED_DOCUMENT_TYPES,
    },
  });
}
