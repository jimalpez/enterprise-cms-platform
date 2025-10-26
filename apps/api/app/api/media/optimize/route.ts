// apps/api/app/api/media/optimize/route.ts
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

interface OptimizeOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: keyof sharp.FormatEnum;
  fit?: keyof sharp.FitEnum;
}

import { existsSync } from "fs";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { validateRequest, optimizeMediaSchema } from "@/lib/validation";

// Configuration
const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const OPTIMIZED_DIR = join(process.cwd(), "public", "uploads", "optimized");

interface OptimizeResponse {
  success: boolean;
  optimized?: {
    id?: string;
    url: string;
    size: number;
    width: number;
    height: number;
    format: string;
  };
  variants?: Array<{
    name: string;
    url: string;
    width: number;
    height: number;
    size: number;
  }>;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
}

// Predefined image variants
const IMAGE_VARIANTS = [
  { name: "thumbnail", width: 150, height: 150, fit: "cover" as const },
  { name: "small", width: 320, height: 320, fit: "inside" as const },
  { name: "medium", width: 640, height: 640, fit: "inside" as const },
  { name: "large", width: 1280, height: 1280, fit: "inside" as const },
  { name: "xlarge", width: 1920, height: 1920, fit: "inside" as const },
];

// POST /api/media/optimize
export async function POST(
  request: NextRequest,
): Promise<NextResponse<OptimizeResponse>> {
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

    // Parse and validate request body
    const body = await request.json();
    const validation = await validateRequest(optimizeMediaSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 },
      );
    }

    const {
      mediaId,
      url,
      options = {},
      createVariants = false,
    } = validation.data;

    // Create optimized directory if it doesn't exist
    if (!existsSync(OPTIMIZED_DIR)) {
      await mkdir(OPTIMIZED_DIR, { recursive: true });
    }

    let inputBuffer: Buffer;
    let originalMedia: any = null;

    // Get the image buffer
    if (mediaId) {
      // Fetch media from database
      originalMedia = await prisma.media.findUnique({
        where: { id: mediaId },
      });

      if (!originalMedia) {
        return NextResponse.json(
          { success: false, error: "Media not found" },
          { status: 404 },
        );
      }

      // Check if it's an image
      if (!originalMedia.mimetype.startsWith("image/")) {
        return NextResponse.json(
          { success: false, error: "Only images can be optimized" },
          { status: 400 },
        );
      }

      // Read the original file
      const originalPath = join(process.cwd(), "public", originalMedia.url);

      try {
        inputBuffer = await readFile(originalPath);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: "Failed to read original file" },
          { status: 404 },
        );
      }
    } else if (url) {
      // Fetch from URL
      try {
        const response = await fetch(url);
        if (!response.ok) {
          return NextResponse.json(
            { success: false, error: "Failed to fetch image from URL" },
            { status: 400 },
          );
        }
        const arrayBuffer = await response.arrayBuffer();
        inputBuffer = Buffer.from(arrayBuffer);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: "Failed to fetch image from URL" },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Either mediaId or url must be provided" },
        { status: 400 },
      );
    }

    // Process main optimized image
    const {
      width,
      height,
      quality = 85,
      format = "webp",
      fit = "inside",
    } = options as OptimizeOptions;

    let processor = sharp(inputBuffer);

    // Resize if dimensions provided
    if (width || height) {
      processor = processor.resize(width, height, { fit });
    }

    // Convert format and optimize
    switch (format) {
      case "jpeg":
        processor = processor.jpeg({ quality, progressive: true });
        break;
      case "png":
        processor = processor.png({ quality, compressionLevel: 9 });
        break;
      case "webp":
        processor = processor.webp({ quality });
        break;
      case "avif":
        processor = processor.avif({ quality });
        break;
    }

    const optimizedBuffer = await processor.toBuffer();
    const metadata = await sharp(optimizedBuffer).metadata();

    // Generate unique filename for optimized image
    const uniqueId = nanoid(10);
    const optimizedFilename = `optimized-${uniqueId}.${format}`;
    const optimizedPath = join(OPTIMIZED_DIR, optimizedFilename);

    // Write optimized file
    await writeFile(optimizedPath, optimizedBuffer);

    const optimizedUrl = `/uploads/optimized/${optimizedFilename}`;

    // Create media record for optimized image
    let optimizedMedia;
    if (mediaId && originalMedia) {
      optimizedMedia = await prisma.media.create({
        data: {
          url: optimizedUrl,
          filename: `optimized-${originalMedia.filename}`,
          mimetype: `image/${format}`,
          size: optimizedBuffer.length,
          width: metadata.width ?? null,
          height: metadata.height ?? null,
          uploadedBy: user.userId,
        },
      });
    }

    const result: OptimizeResponse = {
      success: true,
      optimized: {
        id: optimizedMedia?.id,
        url: optimizedUrl,
        size: optimizedBuffer.length,
        width: metadata.width!,
        height: metadata.height!,
        format,
      },
    };

    // Create variants if requested
    if (createVariants) {
      const variants = await Promise.all(
        IMAGE_VARIANTS.map(async (variant) => {
          const variantBuffer = await sharp(inputBuffer)
            .resize(variant.width, variant.height, { fit: variant.fit })
            .webp({ quality: 85 })
            .toBuffer();

          const variantMetadata = await sharp(variantBuffer).metadata();
          const variantFilename = `${variant.name}-${uniqueId}.webp`;
          const variantPath = join(OPTIMIZED_DIR, variantFilename);

          await writeFile(variantPath, variantBuffer);

          // Create media record for each variant
          if (mediaId && originalMedia) {
            await prisma.media.create({
              data: {
                url: `/uploads/optimized/${variantFilename}`,
                filename: `${variant.name}-${originalMedia.filename}`,
                mimetype: "image/webp",
                size: variantBuffer.length,
                width: variantMetadata.width ?? null,
                height: variantMetadata.height ?? null,
                uploadedBy: user.userId,
              },
            });
          }

          return {
            name: variant.name,
            url: `/uploads/optimized/${variantFilename}`,
            width: variantMetadata.width!,
            height: variantMetadata.height!,
            size: variantBuffer.length,
          };
        }),
      );

      result.variants = variants;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Optimization error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to optimize image",
      },
      { status: 500 },
    );
  }
}

// GET /api/media/optimize
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    supportedFormats: ["jpeg", "png", "webp", "avif"],
    fitOptions: ["cover", "contain", "fill", "inside", "outside"],
    variants: IMAGE_VARIANTS.map((v) => ({
      name: v.name,
      width: v.width,
      height: v.height,
      fit: v.fit,
    })),
    defaultQuality: 85,
  });
}
