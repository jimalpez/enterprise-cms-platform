import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { GET } from "../../../../app/api/search/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateRequest } from "@/lib/validation";

// Mock all dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    content: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/validation", () => ({
  validateRequest: vi.fn(),
  searchSchema: {},
}));

describe("GET /api/search", () => {
  const mockAuthor = {
    id: "author-123",
    name: "John Doe",
    email: "john@example.com",
    avatar: "https://example.com/avatar.jpg",
    role: "author",
  };

  const mockContent = {
    id: "content-123",
    title: "Getting Started with React",
    slug: "getting-started-with-react",
    excerpt: "Learn the basics of React",
    content: "This is a comprehensive guide to React...",
    type: "article",
    status: "published",
    featuredImage: "https://example.com/react.jpg",
    tags: ["react", "javascript", "frontend"],
    publishedAt: new Date("2024-01-15"),
    createdAt: new Date("2024-01-10"),
    updatedAt: new Date("2024-01-15"),
    author: mockAuthor,
    authorId: "author-123",
  };

  const mockContents = [
    mockContent,
    {
      ...mockContent,
      id: "content-456",
      title: "Advanced React Patterns",
      slug: "advanced-react-patterns",
      excerpt: "Deep dive into React patterns",
      tags: ["react", "advanced", "patterns"],
      createdAt: new Date("2024-01-20"),
    },
  ];

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Default successful mocks
    (validateRequest as Mock).mockResolvedValue({
      success: true,
      data: {
        page: 1,
        limit: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
      },
    });
  });

  // Helper function to create mock request
  const createMockRequest = (searchParams: Record<string, string> = {}) => {
    const url = new URL("http://localhost:3000/api/search");
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return new NextRequest(url);
  };

  describe("Basic Search", () => {
    it("should search content by query text", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          q: "react",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({ q: "react" });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items).toHaveLength(2);
      expect(data.data.items[0].title).toContain("React");
      expect(data.data.pagination.total).toBe(2);
    });

    it("should search in title, content, and excerpt fields", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          q: "tutorial",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({ q: "tutorial" });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.OR).toBeDefined();
      expect(whereClause.OR).toHaveLength(3);
      expect(whereClause.OR[0]).toEqual({
        title: { contains: "tutorial", mode: "insensitive" },
      });
      expect(whereClause.OR[1]).toEqual({
        content: { contains: "tutorial", mode: "insensitive" },
      });
      expect(whereClause.OR[2]).toEqual({
        excerpt: { contains: "tutorial", mode: "insensitive" },
      });
    });

    it("should perform case-insensitive search", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          q: "REACT",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({ q: "REACT" });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.OR[0].title.mode).toBe("insensitive");
    });

    it("should return empty results when no matches found", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          q: "nonexistent",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([]);
      (prisma.content.count as Mock).mockResolvedValue(0);

      const request = createMockRequest({ q: "nonexistent" });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items).toHaveLength(0);
      expect(data.data.pagination.total).toBe(0);
    });
  });

  describe("Filter by Type", () => {
    it("should filter by content type", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          type: "article",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([mockContent]);
      (prisma.content.count as Mock).mockResolvedValue(1);

      const request = createMockRequest({ type: "article" });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.type).toBe("article");
    });

    it("should support different content types", async () => {
      // Arrange
      const types = ["article", "page", "media"];

      for (const type of types) {
        vi.clearAllMocks();

        (validateRequest as Mock).mockResolvedValue({
          success: true,
          data: {
            type,
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
          },
        });

        (prisma.content.findMany as Mock).mockResolvedValue([]);
        (prisma.content.count as Mock).mockResolvedValue(0);

        const request = createMockRequest({ type });

        // Act
        await GET(request);

        // Assert
        const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
          .where;
        expect(whereClause.type).toBe(type);
      }
    });
  });

  describe("Filter by Status", () => {
    it("should filter by status", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          status: "published",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({ status: "published" });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.status).toBe("published");
    });

    it("should support different status values", async () => {
      // Arrange
      const statuses = ["draft", "published", "archived"];

      for (const status of statuses) {
        vi.clearAllMocks();

        (validateRequest as Mock).mockResolvedValue({
          success: true,
          data: {
            status,
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
          },
        });

        (prisma.content.findMany as Mock).mockResolvedValue([]);
        (prisma.content.count as Mock).mockResolvedValue(0);

        const request = createMockRequest({ status });

        // Act
        await GET(request);

        // Assert
        const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
          .where;
        expect(whereClause.status).toBe(status);
      }
    });
  });

  describe("Filter by Tags", () => {
    it("should filter by single tag", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          tags: ["react"],
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({ tags: "react" });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.tags).toEqual({ hasSome: ["react"] });
    });

    it("should filter by multiple tags", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          tags: ["react", "javascript", "frontend"],
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({ tags: "react,javascript,frontend" });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.tags).toEqual({
        hasSome: ["react", "javascript", "frontend"],
      });
    });

    it("should trim whitespace from tags", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          tags: ["react", "javascript"],
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({ tags: " react , javascript " });

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
    });
  });

  describe("Filter by Author", () => {
    it("should filter by author ID", async () => {
      // Arrange
      const authorId = "cmgyzbf960000m5u4cc3waw3v";

      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          author: authorId,
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([mockContent]);
      (prisma.content.count as Mock).mockResolvedValue(1);

      const request = createMockRequest({ author: authorId });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.authorId).toBe(authorId);
    });

    it("should filter by author name", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          author: "John",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([mockContent]);
      (prisma.content.count as Mock).mockResolvedValue(1);

      const request = createMockRequest({ author: "John" });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.author.OR).toBeDefined();
      expect(whereClause.author.OR[0]).toEqual({
        name: { contains: "John", mode: "insensitive" },
      });
    });

    it("should filter by author email", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          author: "john@example.com",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([mockContent]);
      (prisma.content.count as Mock).mockResolvedValue(1);

      const request = createMockRequest({ author: "john@example.com" });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.author.OR).toBeDefined();
      expect(whereClause.author.OR[1]).toEqual({
        email: { contains: "john@example.com", mode: "insensitive" },
      });
    });

    it("should detect CUID format for author ID", async () => {
      // Arrange
      const cuidAuthorId = "c123456789012345678901234";

      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          author: cuidAuthorId,
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([mockContent]);
      (prisma.content.count as Mock).mockResolvedValue(1);

      const request = createMockRequest({ author: cuidAuthorId });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.authorId).toBe(cuidAuthorId);
      expect(whereClause.author).toBeUndefined();
    });
  });

  describe("Date Filtering", () => {
    it("should filter by year", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          date: "2024",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({ date: "2024" });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.createdAt.gte).toEqual(
        new Date("2024-01-01T00:00:00.000Z"),
      );
      expect(whereClause.createdAt.lte).toEqual(
        new Date("2024-12-31T23:59:59.999Z"),
      );
    });

    it("should filter by specific date", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          date: "2024-01-15",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([mockContent]);
      (prisma.content.count as Mock).mockResolvedValue(1);

      const request = createMockRequest({ date: "2024-01-15" });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.createdAt.gte).toBeDefined();
      expect(whereClause.createdAt.lte).toBeDefined();

      const gte = whereClause.createdAt.gte;
      const lte = whereClause.createdAt.lte;
      expect(gte.getHours()).toBe(0);
      expect(lte.getHours()).toBe(23);
    });

    it("should filter by date range with dateFrom", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          dateFrom: "2024-01-01",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({ dateFrom: "2024-01-01" });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.createdAt.gte).toEqual(new Date("2024-01-01"));
    });

    it("should filter by date range with dateTo", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          dateTo: "2024-12-31",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({ dateTo: "2024-12-31" });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.createdAt.lte).toEqual(new Date("2024-12-31"));
    });

    it("should filter by date range with both dateFrom and dateTo", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          dateFrom: "2024-01-01",
          dateTo: "2024-12-31",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({
        dateFrom: "2024-01-01",
        dateTo: "2024-12-31",
      });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.createdAt.gte).toEqual(new Date("2024-01-01"));
      expect(whereClause.createdAt.lte).toEqual(new Date("2024-12-31"));
    });
  });

  describe("Pagination", () => {
    it("should paginate results with default values", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(25);

      const request = createMockRequest({});

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.data.pagination).toEqual({
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
        hasMore: true,
      });
    });

    it("should handle custom page and limit", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 2,
          limit: 5,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(25);

      const request = createMockRequest({ page: "2", limit: "5" });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.data.pagination).toEqual({
        total: 25,
        page: 2,
        limit: 5,
        totalPages: 5,
        hasMore: true,
      });

      const callArgs = (prisma.content.findMany as Mock).mock.calls[0][0];
      expect(callArgs.skip).toBe(5); // (page - 1) * limit
      expect(callArgs.take).toBe(5);
    });

    it("should calculate correct totalPages", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(23);

      const request = createMockRequest({ limit: "10" });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.data.pagination.totalPages).toBe(3);
    });

    it("should set hasMore correctly on last page", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 3,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(22);

      const request = createMockRequest({ page: "3", limit: "10" });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.data.pagination.hasMore).toBe(false);
    });
  });

  describe("Sorting", () => {
    it("should sort by createdAt descending by default", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({});

      // Act
      await GET(request);

      // Assert
      const callArgs = (prisma.content.findMany as Mock).mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ createdAt: "desc" });
    });

    it("should sort by different fields", async () => {
      // Arrange
      const sortFields = ["createdAt", "updatedAt", "publishedAt", "title"];

      for (const sortBy of sortFields) {
        vi.clearAllMocks();

        (validateRequest as Mock).mockResolvedValue({
          success: true,
          data: {
            page: 1,
            limit: 10,
            sortBy,
            sortOrder: "asc",
          },
        });

        (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
        (prisma.content.count as Mock).mockResolvedValue(2);

        const request = createMockRequest({ sortBy, sortOrder: "asc" });

        // Act
        await GET(request);

        // Assert
        const callArgs = (prisma.content.findMany as Mock).mock.calls[0][0];
        expect(callArgs.orderBy).toEqual({ [sortBy]: "asc" });
      }
    });

    it("should sort ascending or descending", async () => {
      // Arrange - Ascending
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 1,
          limit: 10,
          sortBy: "title",
          sortOrder: "asc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request1 = createMockRequest({ sortBy: "title", sortOrder: "asc" });

      // Act
      await GET(request1);

      // Assert
      let callArgs = (prisma.content.findMany as Mock).mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ title: "asc" });

      vi.clearAllMocks();

      // Arrange - Descending
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 1,
          limit: 10,
          sortBy: "title",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request2 = createMockRequest({
        sortBy: "title",
        sortOrder: "desc",
      });

      await GET(request2);

      callArgs = (prisma.content.findMany as Mock).mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ title: "desc" });
    });
  });

  describe("Combined Filters", () => {
    it("should combine multiple filters", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          q: "react",
          type: "article",
          status: "published",
          tags: ["frontend"],
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([mockContent]);
      (prisma.content.count as Mock).mockResolvedValue(1);

      const request = createMockRequest({
        q: "react",
        type: "article",
        status: "published",
        tags: "frontend",
      });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.OR).toBeDefined(); // Text search
      expect(whereClause.type).toBe("article");
      expect(whereClause.status).toBe("published");
      expect(whereClause.tags).toEqual({ hasSome: ["frontend"] });
    });

    it("should combine text search with author filter", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          q: "tutorial",
          author: "John",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([mockContent]);
      (prisma.content.count as Mock).mockResolvedValue(1);

      const request = createMockRequest({ q: "tutorial", author: "John" });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.OR).toBeDefined(); // Text search
      expect(whereClause.author).toBeDefined(); // Author filter
    });

    it("should combine date range with other filters", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          type: "article",
          dateFrom: "2024-01-01",
          dateTo: "2024-12-31",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({
        type: "article",
        dateFrom: "2024-01-01",
        dateTo: "2024-12-31",
      });

      // Act
      await GET(request);

      // Assert
      const whereClause = (prisma.content.findMany as Mock).mock.calls[0][0]
        .where;
      expect(whereClause.type).toBe("article");
      expect(whereClause.createdAt).toBeDefined();
    });
  });

  describe("Response Structure", () => {
    it("should return correct response structure", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          q: "react",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({ q: "react" });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data).toHaveProperty("success", true);
      expect(data).toHaveProperty("data");
      expect(data.data).toHaveProperty("items");
      expect(data.data).toHaveProperty("pagination");
      expect(data.data).toHaveProperty("filters");
    });

    it("should include author information in results", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([mockContent]);
      (prisma.content.count as Mock).mockResolvedValue(1);

      const request = createMockRequest({});

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      const item = data.data.items[0];
      expect(item.author).toBeDefined();
      expect(item.author.id).toBe(mockAuthor.id);
      expect(item.author.name).toBe(mockAuthor.name);
      expect(item.author.email).toBe(mockAuthor.email);
    });

    it("should not include full content in search results", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([mockContent]);
      (prisma.content.count as Mock).mockResolvedValue(1);

      const request = createMockRequest({});

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      const item = data.data.items[0];
      expect(item).not.toHaveProperty("content");
      expect(item).toHaveProperty("excerpt");
    });

    it("should include applied filters in response", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          q: "react",
          type: "article",
          status: "published",
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([mockContent]);
      (prisma.content.count as Mock).mockResolvedValue(1);

      const request = createMockRequest({
        q: "react",
        type: "article",
        status: "published",
      });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.data.filters).toEqual({
        q: "react",
        type: "article",
        author: null,
        status: "published",
        tags: null,
        date: null,
        dateFrom: null,
        dateTo: null,
      });
    });
  });

  describe("Validation Errors", () => {
    it("should return 400 for invalid parameters", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: false,
        errors: {
          limit: "Limit must be between 1 and 100",
        },
      });

      const request = createMockRequest({ limit: "200" });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toEqual({
        limit: "Limit must be between 1 and 100",
      });
    });

    it("should validate page number", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: false,
        errors: {
          page: "Page must be a positive number",
        },
      });

      const request = createMockRequest({ page: "0" });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when database query fails", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const request = createMockRequest({});

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Database connection failed");
    });

    it("should log errors to console", async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockError = new Error("Unexpected error");

      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockRejectedValue(mockError);

      const request = createMockRequest({});

      // Act
      await GET(request);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith("Search error:", mockError);

      consoleErrorSpy.mockRestore();
    });

    it("should handle non-Error exceptions", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockRejectedValue("String error");

      const request = createMockRequest({});

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.error).toBe("An error occurred during search");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty search query", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue(mockContents);
      (prisma.content.count as Mock).mockResolvedValue(2);

      const request = createMockRequest({ q: "" });

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it("should handle very long search query", async () => {
      // Arrange
      const longQuery = "a".repeat(1000);

      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          q: longQuery,
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([]);
      (prisma.content.count as Mock).mockResolvedValue(0);

      const request = createMockRequest({ q: longQuery });

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
    });

    it("should handle page beyond available results", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          page: 100,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([]);
      (prisma.content.count as Mock).mockResolvedValue(25);

      const request = createMockRequest({ page: "100" });

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.items).toHaveLength(0);
      expect(data.data.pagination.hasMore).toBe(false);
    });

    it("should handle special characters in search query", async () => {
      // Arrange
      const specialQuery = "React & Redux: The $100 Guide!";

      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          q: specialQuery,
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        },
      });

      (prisma.content.findMany as Mock).mockResolvedValue([]);
      (prisma.content.count as Mock).mockResolvedValue(0);

      const request = createMockRequest({ q: specialQuery });

      // Act
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
    });
  });
});
