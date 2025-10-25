// apps/api/app/api/content/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
  extractTokenFromHeader,
  hasPermission,
} from "@/lib/auth";
import { validateRequest, updateContentSchema } from "@/lib/validation";
import { invalidateCache, getCached } from "@/lib/redis";

// GET /api/content/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    // Try to get from cache
    const content = await getCached(
      `content:${id}`,
      async () => {
        return await prisma.content.findUnique({
          where: { id },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                role: true,
              },
            },
            comments: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        });
      },
      3600, // 1 hour cache
    );

    if (!content) {
      return NextResponse.json(
        { success: false, error: "Content not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error("Get content by ID error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while fetching content" },
      { status: 500 },
    );
  }
}

// PUT /api/content/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

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

    // Get existing content
    const existingContent = await prisma.content.findUnique({
      where: { id },
    });

    if (!existingContent) {
      return NextResponse.json(
        { success: false, error: "Content not found" },
        { status: 404 },
      );
    }

    // Check permissions
    const isOwner = existingContent.authorId === payload.userId;
    const canEdit =
      hasPermission(payload.role, "content:*") ||
      (isOwner && hasPermission(payload.role, "content:edit:own"));

    if (!canEdit) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = await validateRequest(updateContentSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 },
      );
    }

    const data = validation.data;

    // Check slug uniqueness if changed
    if (data.slug && data.slug !== existingContent.slug) {
      const slugExists = await prisma.content.findUnique({
        where: { slug: data.slug },
      });

      if (slugExists) {
        return NextResponse.json(
          { success: false, error: "Slug already exists" },
          { status: 409 },
        );
      }
    }

    // Update content
    const content = await prisma.content.update({
      where: { id },
      data: {
        ...data,
        version: {
          increment: 1,
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Create new version
    await prisma.contentVersion.create({
      data: {
        contentId: content.id,
        version: content.version,
        data: {
          title: content.title,
          content: content.content,
          excerpt: content.excerpt,
        },
        createdBy: payload.userId,
      },
    });

    // Invalidate cache
    await invalidateCache(`content:${id}`);
    await invalidateCache("content:*");

    return NextResponse.json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error("Update content error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while updating content" },
      { status: 500 },
    );
  }
}

// DELETE /api/content/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

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

    // Get existing content
    const existingContent = await prisma.content.findUnique({
      where: { id },
    });

    if (!existingContent) {
      return NextResponse.json(
        { success: false, error: "Content not found" },
        { status: 404 },
      );
    }

    // Check permissions - only admins and editors can delete
    if (!hasPermission(payload.role, "content:*")) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Delete content (cascade will delete versions and comments)
    await prisma.content.delete({
      where: { id },
    });

    // Invalidate cache
    await invalidateCache(`content:${id}`);
    await invalidateCache("content:*");

    return NextResponse.json({
      success: true,
      message: "Content deleted successfully",
    });
  } catch (error) {
    console.error("Delete content error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while deleting content" },
      { status: 500 },
    );
  }
}
