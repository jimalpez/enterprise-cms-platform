// apps/api/app/api/media/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { prisma } from "@/lib/prisma";
import { authenticateRequest, canModifyResource } from "@/lib/auth";

interface MediaResponse {
  success: boolean;
  media?: {
    id: string;
    url: string;
    filename: string;
    mimetype: string;
    size: number;
    width: number | null;
    height: number | null;
    createdAt: string;
    uploader: {
      id: string;
      name: string;
      email: string;
    };
  };
  error?: string;
}

// GET /api/media/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse<MediaResponse>> {
  try {
    // Authentication check
    const authHeader = request.headers.get("authorization");
    const user = authenticateRequest(authHeader);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const media = await prisma.media.findUnique({
      where: { id: params.id },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!media) {
      return NextResponse.json(
        { success: false, error: "Media not found" },
        { status: 404 },
      );
    }

    // Check permissions - viewers can only see their own uploads
    if (
      !["admin", "editor"].includes(user.role) &&
      media.uploadedBy !== user.userId
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      media: {
        id: media.id,
        url: media.url,
        filename: media.filename,
        mimetype: media.mimetype,
        size: media.size,
        width: media.width,
        height: media.height,
        createdAt: media.createdAt.toISOString(),
        uploader: media.uploader,
      },
    });
  } catch (error) {
    console.error("Get media error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch media",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/media/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse<{ success: boolean; error?: string }>> {
  try {
    // Authentication check
    const authHeader = request.headers.get("authorization");
    const user = authenticateRequest(authHeader);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Fetch media to check ownership
    const media = await prisma.media.findUnique({
      where: { id: params.id },
    });

    if (!media) {
      return NextResponse.json(
        { success: false, error: "Media not found" },
        { status: 404 },
      );
    }

    // Check permissions - users can only delete their own uploads or admin/editor can delete any
    if (!canModifyResource(user.role, user.userId, media.uploadedBy)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Cannot delete this media" },
        { status: 403 },
      );
    }

    // Check if media is being used
    const contentUsingMedia = await prisma.content.findFirst({
      where: { featuredImage: media.url },
    });

    if (contentUsingMedia) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete: Media is being used in content",
        },
        { status: 409 },
      );
    }

    // Delete file from disk if requested
    const deleteFile =
      request.nextUrl.searchParams.get("deleteFile") !== "false";

    if (deleteFile) {
      const filepath = join(process.cwd(), "public", media.url);

      try {
        if (existsSync(filepath)) {
          await unlink(filepath);
        }
      } catch (error) {
        console.error("Failed to delete file:", error);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    await prisma.media.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete media error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete media",
      },
      { status: 500 },
    );
  }
}

// PATCH /api/media/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse<MediaResponse>> {
  try {
    // Authentication check
    const authHeader = request.headers.get("authorization");
    const user = authenticateRequest(authHeader);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Fetch media to check ownership
    const existingMedia = await prisma.media.findUnique({
      where: { id: params.id },
    });

    if (!existingMedia) {
      return NextResponse.json(
        { success: false, error: "Media not found" },
        { status: 404 },
      );
    }

    // Check permissions
    if (!canModifyResource(user.role, user.userId, existingMedia.uploadedBy)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Cannot update this media" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { filename } = body;

    if (!filename || typeof filename !== "string") {
      return NextResponse.json(
        { success: false, error: "Invalid filename" },
        { status: 400 },
      );
    }

    // Update media
    const updatedMedia = await prisma.media.update({
      where: { id: params.id },
      data: { filename },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      media: {
        id: updatedMedia.id,
        url: updatedMedia.url,
        filename: updatedMedia.filename,
        mimetype: updatedMedia.mimetype,
        size: updatedMedia.size,
        width: updatedMedia.width,
        height: updatedMedia.height,
        createdAt: updatedMedia.createdAt.toISOString(),
        uploader: updatedMedia.uploader,
      },
    });
  } catch (error) {
    console.error("Update media error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update media",
      },
      { status: 500 },
    );
  }
}
