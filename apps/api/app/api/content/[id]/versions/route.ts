import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    const article = await prisma.content.findUnique({
      where: { id },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, error: "Article not found" },
        { status: 404 },
      );
    }

    const versions = await prisma.contentVersion.findMany({
      where: { contentId: id },
      orderBy: { version: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    console.error("[v0] Get versions error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
