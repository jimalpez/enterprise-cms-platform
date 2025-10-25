import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  metadataSchema,
  createContentSchema,
  updateContentSchema,
  publishContentSchema,
  createCommentSchema,
  updateCommentSchema,
  getCommentsSchema,
  optimizeMediaSchema,
  mediaQuerySchema,
  bulkMediaSchema,
  searchSchema,
  formatZodError,
  validateRequest,
  isImage,
  isVideo,
  isDocument,
  formatFileSize,
  getFileExtension,
  sanitizeFilename,
  validateFileUpload,
} from "@/lib/validation";
import { z } from "zod";

describe("Auth Schemas", () => {
  describe("loginSchema", () => {
    it("should validate correct login data", async () => {
      // Arrange
      const validData = {
        email: "user@example.com",
        password: "password123",
      };

      // Act
      const result = loginSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("should reject invalid email", async () => {
      // Arrange
      const invalidData = {
        email: "invalid-email",
        password: "password123",
      };

      // Act
      const result = loginSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Invalid email address");
      }
    });

    it("should reject short password", async () => {
      // Arrange
      const invalidData = {
        email: "user@example.com",
        password: "short",
      };

      // Act
      const result = loginSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          "at least 8 characters",
        );
      }
    });

    it("should reject missing fields", async () => {
      // Arrange
      const invalidData = { email: "user@example.com" };

      // Act
      const result = loginSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("registerSchema", () => {
    it("should validate correct registration data", async () => {
      // Arrange
      const validData = {
        email: "newuser@example.com",
        password: "Password123",
        name: "John Doe",
      };

      // Act
      const result = registerSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("should reject password without uppercase", async () => {
      // Arrange
      const invalidData = {
        email: "user@example.com",
        password: "password123",
        name: "John Doe",
      };

      // Act
      const result = registerSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("uppercase");
      }
    });

    it("should reject password without lowercase", async () => {
      // Arrange
      const invalidData = {
        email: "user@example.com",
        password: "PASSWORD123",
        name: "John Doe",
      };

      // Act
      const result = registerSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("lowercase");
      }
    });

    it("should reject password without number", async () => {
      // Arrange
      const invalidData = {
        email: "user@example.com",
        password: "Password",
        name: "John Doe",
      };

      // Act
      const result = registerSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("number");
      }
    });

    it("should reject short name", async () => {
      // Arrange
      const invalidData = {
        email: "user@example.com",
        password: "Password123",
        name: "J",
      };

      // Act
      const result = registerSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          "at least 2 characters",
        );
      }
    });
  });

  describe("refreshTokenSchema", () => {
    it("should validate correct refresh token", async () => {
      // Arrange
      const validData = { refreshToken: "valid_token_string" };

      // Act
      const result = refreshTokenSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should reject empty refresh token", async () => {
      // Arrange
      const invalidData = { refreshToken: "" };

      // Act
      const result = refreshTokenSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject missing refresh token", async () => {
      // Arrange
      const invalidData = {};

      // Act
      const result = refreshTokenSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe("Content Schemas", () => {
  describe("createContentSchema", () => {
    it("should validate minimal content data", async () => {
      // Arrange
      const validData = {
        title: "Test Article",
        slug: "test-article",
        content: "Article content",
      };

      // Act
      const result = createContentSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("article");
        expect(result.data.status).toBe("draft");
      }
    });

    it("should validate complete content data", async () => {
      // Arrange
      const validData = {
        title: "Test Article",
        slug: "test-article",
        content: "Article content",
        excerpt: "Article excerpt",
        type: "article" as const,
        status: "published" as const,
        featuredImage: "https://example.com/image.jpg",
        tags: ["javascript", "tutorial"],
        metadata: { category: "tech", readTime: "5 min" },
      };

      // Act
      const result = createContentSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject({
          title: validData.title,
          slug: validData.slug,
          content: validData.content,
          excerpt: validData.excerpt,
          type: validData.type,
          status: validData.status,
        });
      }
    });

    it("should reject invalid slug format", async () => {
      // Arrange
      const invalidData = {
        title: "Test Article",
        slug: "Test Article!", // Contains uppercase and special chars
        content: "Article content",
      };

      // Act
      const result = createContentSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("lowercase");
      }
    });

    it("should reject empty title", async () => {
      // Arrange
      const invalidData = {
        title: "",
        slug: "test-article",
        content: "Article content",
      };

      // Act
      const result = createContentSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject invalid featured image URL", async () => {
      // Arrange
      const invalidData = {
        title: "Test Article",
        slug: "test-article",
        content: "Article content",
        featuredImage: "not-a-url",
      };

      // Act
      const result = createContentSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should accept empty string for featured image", async () => {
      // Arrange
      const validData = {
        title: "Test Article",
        slug: "test-article",
        content: "Article content",
        featuredImage: "",
      };

      // Act
      const result = createContentSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should apply default values", async () => {
      // Arrange
      const minimalData = {
        title: "Test",
        slug: "test",
        content: "Content",
      };

      // Act
      const result = createContentSchema.safeParse(minimalData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("article");
        expect(result.data.status).toBe("draft");
        expect(result.data.tags).toEqual([]);
        expect(result.data.metadata).toEqual({});
      }
    });
  });

  describe("updateContentSchema", () => {
    it("should validate partial update", async () => {
      // Arrange
      const validData = { title: "Updated Title" };

      // Act
      const result = updateContentSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should allow updating only slug", async () => {
      // Arrange
      const validData = { slug: "updated-slug" };

      // Act
      const result = updateContentSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should validate multiple fields", async () => {
      // Arrange
      const validData = {
        title: "Updated Title",
        excerpt: "Updated excerpt",
        status: "published" as const,
      };

      // Act
      const result = updateContentSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("publishContentSchema", () => {
    it("should validate publish data with datetime", async () => {
      // Arrange
      const validData = {
        publishedAt: "2025-10-25T10:00:00.000Z",
      };

      // Act
      const result = publishContentSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should allow empty publish data", async () => {
      // Arrange
      const validData = {};

      // Act
      const result = publishContentSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("metadataSchema", () => {
    it("should validate valid metadata", async () => {
      // Arrange
      const validData = {
        category: "tech",
        views: 100,
        featured: true,
        author: null,
      };

      // Act
      const result = metadataSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should accept empty object", async () => {
      // Arrange
      const validData = {};

      // Act
      const result = metadataSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should accept nested values", async () => {
      // Arrange
      const validData = {
        title: "Article",
        count: 5,
        active: true,
        empty: null,
      };

      // Act
      const result = metadataSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});

describe("Comment Schemas", () => {
  describe("createCommentSchema", () => {
    it("should validate correct comment data", async () => {
      // Arrange
      const validData = {
        contentId: "content-123",
        text: "This is a great article!",
      };

      // Act
      const result = createCommentSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should validate comment with parent", async () => {
      // Arrange
      const validData = {
        contentId: "content-123",
        text: "Reply to comment",
        parentId: "parent-123",
      };

      // Act
      const result = createCommentSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should reject empty comment text", async () => {
      // Arrange
      const invalidData = {
        contentId: "content-123",
        text: "",
      };

      // Act
      const result = createCommentSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject comment over 5000 characters", async () => {
      // Arrange
      const invalidData = {
        contentId: "content-123",
        text: "a".repeat(5001),
      };

      // Act
      const result = createCommentSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("5000");
      }
    });
  });

  describe("updateCommentSchema", () => {
    it("should validate comment update", async () => {
      // Arrange
      const validData = {
        text: "Updated comment text",
      };

      // Act
      const result = updateCommentSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should reject empty text", async () => {
      // Arrange
      const invalidData = { text: "" };

      // Act
      const result = updateCommentSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("getCommentsSchema", () => {
    it("should apply default values", async () => {
      // Arrange
      const minimalData = {};

      // Act
      const result = getCommentsSchema.safeParse(minimalData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.sortBy).toBe("createdAt");
        expect(result.data.order).toBe("desc");
      }
    });

    it("should validate custom pagination", async () => {
      // Arrange
      const validData = {
        page: "2",
        limit: "50",
        sortBy: "likes",
        order: "asc",
      };

      // Act
      const result = getCommentsSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
        expect(result.data.sortBy).toBe("likes");
        expect(result.data.order).toBe("asc");
      }
    });

    it("should reject invalid sort field", async () => {
      // Arrange
      const invalidData = { sortBy: "invalid" };

      // Act
      const result = getCommentsSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe("Media Schemas", () => {
  describe("optimizeMediaSchema", () => {
    it("should validate with mediaId", async () => {
      // Arrange
      const validData = { mediaId: "clh4tk4x70005m5ki0y2rarf1" };

      // Act
      const result = optimizeMediaSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should validate with URL", async () => {
      // Arrange
      const validData = { url: "https://example.com/image.jpg" };

      // Act
      const result = optimizeMediaSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should apply default options", async () => {
      // Arrange
      const validData = { mediaId: "clh4tk4x70005m5ki0y2rarf1" };

      // Act
      const result = optimizeMediaSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.options.quality).toBe(85);
        expect(result.data.options.format).toBe("webp");
        expect(result.data.options.fit).toBe("inside");
        expect(result.data.createVariants).toBe(false);
      }
    });

    it("should validate custom options", async () => {
      // Arrange
      const validData = {
        mediaId: "clh4tk4x70005m5ki0y2rarf1",
        options: {
          width: 800,
          height: 600,
          quality: 70,
          format: "jpeg" as const,
          fit: "cover" as const,
        },
        createVariants: true,
      };

      // Act
      const result = optimizeMediaSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.options.width).toBe(800);
        expect(result.data.options.height).toBe(600);
        expect(result.data.createVariants).toBe(true);
      }
    });

    it("should reject without mediaId or url", async () => {
      // Arrange
      const invalidData = {};

      // Act
      const result = optimizeMediaSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("mediaId or url");
      }
    });

    it("should reject dimensions over 4096", async () => {
      // Arrange
      const invalidData = {
        mediaId: "clh4tk4x70005m5ki0y2rarf1",
        options: { width: 5000 },
      };

      // Act
      const result = optimizeMediaSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject quality outside 1-100 range", async () => {
      // Arrange
      const invalidData = {
        mediaId: "clh4tk4x70005m5ki0y2rarf1",
        options: { quality: 150 },
      };

      // Act
      const result = optimizeMediaSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("mediaQuerySchema", () => {
    it("should apply default values", async () => {
      // Arrange
      const minimalData = {};

      // Act
      const result = mediaQuerySchema.safeParse(minimalData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.sortBy).toBe("createdAt");
        expect(result.data.sortOrder).toBe("desc");
      }
    });

    it("should validate complete query", async () => {
      // Arrange
      const validData = {
        page: 2,
        limit: 50,
        search: "test",
        mimetype: "image/jpeg",
        uploadedBy: "clh4tk4x70005m5ki0y2rarf1",
        sortBy: "size",
        sortOrder: "asc",
      };

      // Act
      const result = mediaQuerySchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("bulkMediaSchema", () => {
    it("should validate bulk archive", async () => {
      // Arrange
      const validData = {
        ids: ["clh4tk4x70005m5ki0y2rarf1"],
        action: "archive" as const,
      };

      // Act
      const result = bulkMediaSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should reject empty ids array", async () => {
      // Arrange
      const invalidData = { ids: [], action: "archive" };

      // Act
      const result = bulkMediaSchema.safeParse(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe("Search Schema", () => {
  describe("searchSchema", () => {
    it("should apply default values", async () => {
      // Arrange
      const minimalData = {};

      // Act
      const result = searchSchema.safeParse(minimalData);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
        expect(result.data.sortBy).toBe("createdAt");
        expect(result.data.sortOrder).toBe("desc");
      }
    });

    it("should validate complete search query", async () => {
      // Arrange
      const validData = {
        q: "javascript",
        type: "article",
        author: "john@example.com",
        status: "published",
        tags: ["javascript", "tutorial"],
        date: "2025",
        dateFrom: "2025-01-01T00:00:00.000Z",
        dateTo: "2025-12-31T23:59:59.999Z",
        page: 2,
        limit: 20,
        sortBy: "title",
        sortOrder: "asc",
      };

      // Act
      const result = searchSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should validate search with text query only", async () => {
      // Arrange
      const validData = { q: "search term" };

      // Act
      const result = searchSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should validate search with filters", async () => {
      // Arrange
      const validData = {
        type: "article",
        status: "published",
        tags: ["tech"],
      };

      // Act
      const result = searchSchema.safeParse(validData);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});

describe("Validation Utilities", () => {
  describe("formatZodError", () => {
    it("should format single error", () => {
      // Arrange
      const schema = z.object({ name: z.string().min(2) });
      const result = schema.safeParse({ name: "a" });

      // Act
      if (!result.success) {
        const errors = formatZodError(result.error);

        // Assert
        expect(errors).toHaveLength(1);
        expect(errors[0].field).toBe("name");
        expect(errors[0].message).toContain(
          "Too small: expected string to have >=2 characters",
        );
      }
    });

    it("should format multiple errors", () => {
      // Arrange
      const schema = z.object({
        name: z.string().min(2),
        email: z.string().email(),
      });
      const result = schema.safeParse({ name: "a", email: "invalid" });

      // Act
      if (!result.success) {
        const errors = formatZodError(result.error);

        // Assert
        expect(errors.length).toBeGreaterThan(1);
      }
    });

    it("should format nested errors", () => {
      // Arrange
      const schema = z.object({
        user: z.object({
          name: z.string().min(2),
        }),
      });
      const result = schema.safeParse({ user: { name: "a" } });

      // Act
      if (!result.success) {
        const errors = formatZodError(result.error);

        // Assert
        expect(errors[0].field).toContain("user");
      }
    });
  });

  describe("validateRequest", () => {
    it("should return success for valid data", async () => {
      // Arrange
      const schema = z.object({ name: z.string() });
      const data = { name: "John" };

      // Act
      const result = await validateRequest(schema, data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });

    it("should return errors for invalid data", async () => {
      // Arrange
      const schema = z.object({ name: z.string().min(2) });
      const data = { name: "a" };

      // Act
      const result = await validateRequest(schema, data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it("should handle async validation", async () => {
      // Arrange
      const schema = z.object({
        email: z.string().email(),
      });
      const data = { email: "test@example.com" };

      // Act
      const result = await validateRequest(schema, data);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});

describe("File Type Validators", () => {
  describe("isImage", () => {
    it("should return true for image types", () => {
      expect(isImage("image/jpeg")).toBe(true);
      expect(isImage("image/png")).toBe(true);
      expect(isImage("image/gif")).toBe(true);
      expect(isImage("image/webp")).toBe(true);
    });

    it("should return false for non-image types", () => {
      expect(isImage("video/mp4")).toBe(false);
      expect(isImage("application/pdf")).toBe(false);
      expect(isImage("text/plain")).toBe(false);
    });
  });

  describe("isVideo", () => {
    it("should return true for video types", () => {
      expect(isVideo("video/mp4")).toBe(true);
      expect(isVideo("video/webm")).toBe(true);
      expect(isVideo("video/ogg")).toBe(true);
    });

    it("should return false for non-video types", () => {
      expect(isVideo("image/jpeg")).toBe(false);
      expect(isVideo("application/pdf")).toBe(false);
    });
  });

  describe("isDocument", () => {
    it("should return true for document types", () => {
      expect(isDocument("application/pdf")).toBe(true);
      expect(isDocument("application/msword")).toBe(true);
      expect(
        isDocument(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      ).toBe(true);
      expect(isDocument("application/vnd.ms-excel")).toBe(true);
    });

    it("should return false for non-document types", () => {
      expect(isDocument("image/jpeg")).toBe(false);
      expect(isDocument("video/mp4")).toBe(false);
    });
  });
});
