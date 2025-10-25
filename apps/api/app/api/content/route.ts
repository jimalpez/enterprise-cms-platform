// apps/api/app/api/content/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
  extractTokenFromHeader,
  hasPermission,
} from "@/lib/auth";
import { validateRequest, createContentSchema } from "@/lib/validation";
import { invalidateCache } from "@/lib/redis";
import { Prisma } from "@prisma/client";

// GET /api/content - List all content
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const authorId = searchParams.get("authorId");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (authorId) where.authorId = authorId;

    // Get content with pagination
    const [contents, total] = await Promise.all([
      prisma.content.findMany({
        where,
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
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.content.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: contents,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get content error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while fetching content" },
      { status: 500 },
    );
  }
}

// POST /api/content - Create new content
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
    if (!hasPermission(payload.role, "content:create")) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = await validateRequest(createContentSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 },
      );
    }

    const data = validation.data;

    // Check if slug is unique
    const existingContent = await prisma.content.findUnique({
      where: { slug: data.slug },
    });

    if (existingContent) {
      return NextResponse.json(
        { success: false, error: "Slug already exists" },
        { status: 409 },
      );
    }

    // Create content
    const content = await prisma.content.create({
      data: {
        ...data,
        authorId: payload.userId,
        metadata: data.metadata as Prisma.InputJsonValue,
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

    // Create initial version
    await prisma.contentVersion.create({
      data: {
        contentId: content.id,
        version: 1,
        data: {
          title: content.title,
          content: content.content,
          excerpt: content.excerpt,
        },
        createdBy: payload.userId,
      },
    });

    // Invalidate cache
    await invalidateCache("content:*");

    return NextResponse.json(
      {
        success: true,
        data: content,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create content error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while creating content" },
      { status: 500 },
    );
  }
}
