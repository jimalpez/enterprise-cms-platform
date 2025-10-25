// apps/api/app/api/comments/[id]/like/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken, extractTokenFromHeader } from "@/lib/auth";
import { invalidateCache } from "@/lib/redis";

export async function POST(
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

    // Check comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
    });

    if (!comment) {
      return NextResponse.json(
        { success: false, error: "Comment not found" },
        { status: 404 },
      );
    }

    // Increment likes
    const updated = await prisma.comment.update({
      where: { id: params.id },
      data: { likes: { increment: 1 } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Invalidate cache
    await invalidateCache("comments:*");

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Like comment error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while liking comment" },
      { status: 500 },
    );
  }
}
