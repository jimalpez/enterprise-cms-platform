// apps/api/app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateRequest, searchSchema } from "@/lib/validation";

/**
 * GET /api/search
 * Search content with flexible filters
 *
 * Query Parameters:
 * - q: Search query (searches title, content, excerpt)
 * - type: Content type (article, page, media)
 * - author: Author name, email, or ID
 * - status: Content status (draft, published, archived)
 * - tags: Comma-separated tags
 * - date: Year (2024) or date range
 * - dateFrom: Start date (ISO format)
 * - dateTo: End date (ISO format)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - sortBy: Sort field (createdAt, updatedAt, publishedAt, title)
 * - sortOrder: Sort order (asc, desc)
 *
 * Examples:
 * - /api/search?q=react
 * - /api/search?q=react&type=article
 * - /api/search?q=tutorial&author=john
 * - /api/search?date=2024
 * - /api/search?tags=javascript,nextjs
 * - /api/search?status=published&sortBy=publishedAt&sortOrder=desc
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Convert URLSearchParams to object
    const queryParams: any = {};
    searchParams.forEach((value, key) => {
      if (key === "tags") {
        // Split comma-separated tags
        queryParams[key] = value.split(",").map((tag) => tag.trim());
      } else {
        queryParams[key] = value;
      }
    });

    // Validate search parameters
    const validation = await validateRequest(searchSchema, queryParams);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 },
      );
    }

    const {
      q,
      type,
      author,
      status,
      tags,
      date,
      dateFrom,
      dateTo,
      page,
      limit,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = validation.data;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Text search - searches in title, content, and excerpt
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
        { excerpt: { contains: q, mode: "insensitive" } },
      ];
    }

    // Filter by content type
    if (type) {
      where.type = type;
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    // Author search - supports name, email, or ID
    if (author) {
      // Check if author looks like an ID (cuid format)
      const isCuid = /^c[a-z0-9]{24}$/i.test(author);

      if (isCuid) {
        // Search by ID
        where.authorId = author;
      } else {
        // Search by name or email
        where.author = {
          OR: [
            { name: { contains: author, mode: "insensitive" } },
            { email: { contains: author, mode: "insensitive" } },
          ],
        };
      }
    }

    // Date filtering with multiple formats
    if (date || dateFrom || dateTo) {
      where.createdAt = {};

      // Handle simple year format (e.g., date=2024)
      if (date) {
        const yearMatch = date.match(/^\d{4}$/);
        if (yearMatch) {
          const year = parseInt(date);
          where.createdAt.gte = new Date(`${year}-01-01T00:00:00.000Z`);
          where.createdAt.lte = new Date(`${year}-12-31T23:59:59.999Z`);
        } else {
          // Try to parse as full date
          const parsedDate = new Date(date);
          if (!isNaN(parsedDate.getTime())) {
            // Search for that specific day
            const startOfDay = new Date(parsedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(parsedDate);
            endOfDay.setHours(23, 59, 59, 999);

            where.createdAt.gte = startOfDay;
            where.createdAt.lte = endOfDay;
          }
        }
      }

      // Handle date range
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Build orderBy clause
    const orderBy: any = {};
    if (sortBy === "publishedAt") {
      // Sort by publishedAt, with nulls last
      orderBy.publishedAt = sortOrder;
    } else {
      orderBy[sortBy] = sortOrder;
    }

    // Execute search query
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
              role: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.content.count({ where }),
    ]);

    // Format results
    const items = contents.map((content) => ({
      id: content.id,
      title: content.title,
      slug: content.slug,
      excerpt: content.excerpt,
      type: content.type,
      status: content.status,
      featuredImage: content.featuredImage,
      tags: content.tags,
      publishedAt: content.publishedAt,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      author: content.author,
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + contents.length < total,
        },
        filters: {
          q: q || null,
          type: type || null,
          author: author || null,
          status: status || null,
          tags: tags || null,
          date: date || null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        },
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An error occurred during search",
      },
      { status: 500 },
    );
  }
}
