// apps/api/app/api/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
  extractTokenFromHeader,
  hasPermission,
} from "@/lib/auth";
import { validateRequest, createCommentSchema } from "@/lib/validation";
import { invalidateCache } from "@/lib/redis";

// GET /api/comments - List all comments for a content item
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get("contentId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const order = (searchParams.get("order") || "desc") as "asc" | "desc";

    if (!contentId) {
      return NextResponse.json(
        { success: false, error: "contentId query parameter is required" },
        { status: 400 },
      );
    }

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      contentId,
      parentId: null,
    };

    // Get comments with pagination
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
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
                  email: true,
                  avatar: true,
                  role: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          _count: {
            select: { replies: true },
          },
        },
        orderBy: sortBy === "likes" ? { likes: order } : { [sortBy]: order },
        skip,
        take: limit,
      }),
      prisma.comment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: comments,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while fetching comments" },
      { status: 500 },
    );
  }
}

// POST /api/comments - Create new comment
export async function POST(request: NextRequest) {
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

    // Check permissions
    if (!hasPermission(payload.role, "comments:create")) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = await validateRequest(createCommentSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 },
      );
    }

    const data = validation.data;

    // Check if content exists
    const content = await prisma.content.findUnique({
      where: { id: data.contentId },
    });

    if (!content) {
      return NextResponse.json(
        { success: false, error: "Content not found" },
        { status: 404 },
      );
    }

    // If it's a reply, validate parent comment
    if (data.parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: data.parentId },
      });

      if (!parentComment || parentComment.contentId !== data.contentId) {
        return NextResponse.json(
          { success: false, error: "Invalid parent comment" },
          { status: 400 },
        );
      }
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        text: data.text,
        contentId: data.contentId,
        userId: payload.userId,
        parentId: data.parentId || null,
      },
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

    return NextResponse.json(
      {
        success: true,
        data: comment,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while creating comment" },
      { status: 500 },
    );
  }
}
