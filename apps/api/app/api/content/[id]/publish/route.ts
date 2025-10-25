// apps/api/app/api/content/[id]/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
  extractTokenFromHeader,
  hasPermission,
} from "@/lib/auth";
import { invalidateCache } from "@/lib/redis";

// POST /api/content/[id]/publish
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Content ID is required" },
        { status: 400 },
      );
    }

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
    if (!hasPermission(payload.role, "content:*")) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Get and publish content
    const content = await prisma.content.update({
      where: { id },
      data: {
        status: "published",
        publishedAt: new Date(),
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

    // Invalidate cache
    await invalidateCache(`content:${id}`);
    await invalidateCache("content:*");

    return NextResponse.json({
      success: true,
      data: content,
      message: "Content published successfully",
    });
  } catch (error) {
    console.error("Publish content error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while publishing content" },
      { status: 500 },
    );
  }
}
