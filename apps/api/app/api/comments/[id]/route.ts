// apps/api/app/api/comments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
  extractTokenFromHeader,
  hasPermission,
} from "@/lib/auth";
import { validateRequest, updateCommentSchema } from "@/lib/validation";
import { invalidateCache } from "@/lib/redis";

// GET /api/comments/[id] - Get single comment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        parent: {
          select: {
            id: true,
            text: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: { replies: true },
        },
      },
    });

    if (!comment) {
      return NextResponse.json(
        { success: false, error: "Comment not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error("Get comment error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while fetching comment" },
      { status: 500 },
    );
  }
}

// PUT /api/comments/[id] - Update comment
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Authenticate user
    const token = extractTokenFromHeader(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = await validateRequest(updateCommentSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 },
      );
    }

    const data = validation.data;

    // Find comment
    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
    });

    if (!comment) {
      return NextResponse.json(
        { success: false, error: "Comment not found" },
        { status: 404 },
      );
    }

    // Check permissions - user must own comment OR have comments:moderate permission
    const canEdit =
      comment.userId === payload.userId ||
      hasPermission(payload.role, "comments:moderate");

    if (!canEdit) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Update comment
    const updatedComment = await prisma.comment.update({
      where: { id: params.id },
      data: { text: data.text },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    // Invalidate cache
    await invalidateCache("comments:*");

    return NextResponse.json({
      success: true,
      data: updatedComment,
    });
  } catch (error) {
    console.error("Update comment error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while updating comment" },
      { status: 500 },
    );
  }
}

// DELETE /api/comments/[id] - Delete comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Authenticate user
    const token = extractTokenFromHeader(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    // Find comment
    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { replies: true } },
      },
    });

    if (!comment) {
      return NextResponse.json(
        { success: false, error: "Comment not found" },
        { status: 404 },
      );
    }

    // Check permissions - user must own comment OR have comments:moderate permission
    const canDelete =
      comment.userId === payload.userId ||
      hasPermission(payload.role, "comments:moderate");

    if (!canDelete) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Delete comment (cascade deletes replies)
    await prisma.comment.delete({
      where: { id: params.id },
    });

    // Invalidate cache
    await invalidateCache("comments:*");

    return NextResponse.json({
      success: true,
      data: {
        deletedCommentId: params.id,
        deletedRepliesCount: comment._count.replies,
      },
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while deleting comment" },
      { status: 500 },
    );
  }
}
