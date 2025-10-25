// apps/api/app/api/comments/[id]/replies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Check parent exists
    const parent = await prisma.comment.findUnique({
      where: { id: params.id },
    });

    if (!parent) {
      return NextResponse.json(
        { success: false, error: "Parent comment not found" },
        { status: 404 },
      );
    }

    // Get replies
    const [replies, total] = await Promise.all([
      prisma.comment.findMany({
        where: { parentId: params.id },
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
          _count: { select: { replies: true } },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.comment.count({ where: { parentId: params.id } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: replies,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get replies error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while fetching replies" },
      { status: 500 },
    );
  }
}
