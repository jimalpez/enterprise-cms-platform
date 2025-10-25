// apps/api/app/api/media/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth";
import { validateRequest, mediaQuerySchema } from "@/lib/validation";

interface MediaListResponse {
  success: boolean;
  media?: Array<{
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
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * GET /api/media
 * Lists all media with filtering and pagination
 *
 * @header Authorization - Bearer token (required)
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 20, max: 100)
 * @query search - Search by filename
 * @query mimetype - Filter by MIME type (e.g., 'image/jpeg')
 * @query uploadedBy - Filter by user ID
 * @query sortBy - Sort field: createdAt, size, filename (default: createdAt)
 * @query sortOrder - Sort order: asc, desc (default: desc)
 * @returns Paginated list of media
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<MediaListResponse>> {
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

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      search: searchParams.get("search") || undefined,
      mimetype: searchParams.get("mimetype") || undefined,
      uploadedBy: searchParams.get("uploadedBy") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") || undefined,
    };

    const validation = await validateRequest(mediaQuerySchema, queryParams);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 },
      );
    }

    const { page, limit, search, mimetype, uploadedBy, sortBy, sortOrder } =
      validation.data;

    // Build where clause
    const where: any = {};

    if (search) {
      where.filename = {
        contains: search,
        mode: "insensitive",
      };
    }

    if (mimetype) {
      where.mimetype = mimetype;
    }

    if (uploadedBy) {
      where.uploadedBy = uploadedBy;
    }

    // If user is not admin/editor, only show their own uploads
    if (!["admin", "editor"].includes(user.role)) {
      where.uploadedBy = user.userId;
    }

    // Count total
    const total = await prisma.media.count({ where });

    // Fetch media
    const media = await prisma.media.findMany({
      where,
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      media: media.map((m) => ({
        id: m.id,
        url: m.url,
        filename: m.filename,
        mimetype: m.mimetype,
        size: m.size,
        width: m.width,
        height: m.height,
        createdAt: m.createdAt.toISOString(),
        uploader: m.uploader,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Media list error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch media",
      },
      { status: 500 },
    );
  }
}
