import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import request from "supertest";
import { NextRequest } from "next/server";

// Import your route handlers
import { GET, POST } from "@/app/api/content/route";
import { GET as GetById, PUT, DELETE } from "@/app/api/content/[id]/route";
import { POST as Publish } from "@/app/api/content/[id]/publish/route";

describe("Content Flow Integration Tests", () => {
  let authToken: string;
  let userId: string;
  let contentId: string;
  let testUser: any;

  // Setup: Create test user and get auth token
  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: "contenttest@example.com",
        password: "hashedPassword123",
        name: "Content Test User",
        role: "editor",
      },
    });

    userId = testUser.id;

    // Generate auth token (adjust based on your auth implementation)
    const { generateAccessToken } = await import("@/lib/auth");
    authToken = generateAccessToken({
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role,
    });
  });

  // Cleanup after all tests
  afterAll(async () => {
    try {
      // Delete test content if userId exists
      if (userId) {
        await prisma.content.deleteMany({
          where: { authorId: userId },
        });

        // Delete test user
        await prisma.user
          .delete({
            where: { id: userId },
          })
          .catch(() => {
            // Ignore if user doesn't exist
          });
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    } finally {
      await prisma.$disconnect();
    }
  });

  // Clean up content between tests
  beforeEach(async () => {
    await prisma.content.deleteMany({
      where: { authorId: userId },
    });
  });

  describe("Complete Content Lifecycle", () => {
    it("should complete full content workflow: create -> read -> update -> publish -> delete", async () => {
      // Step 1: Create content
      const createPayload = {
        title: "Integration Test Article",
        slug: "integration-test-article",
        content: "<p>This is a test article for integration testing.</p>",
        excerpt: "Test article excerpt",
        type: "article",
        status: "draft",
        tags: ["testing", "integration"],
        metadata: { category: "tech" },
      };

      const createRequest = new NextRequest(
        "http://localhost:3000/api/content",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(createPayload),
        },
      );

      const createResponse = await POST(createRequest);
      const createData = await createResponse.json();

      expect(createResponse.status).toBe(201);
      expect(createData.success).toBe(true);
      expect(createData.data).toBeDefined();
      expect(createData.data.title).toBe(createPayload.title);
      expect(createData.data.slug).toBe(createPayload.slug);
      expect(createData.data.status).toBe("draft");
      expect(createData.data.version).toBe(1);

      contentId = createData.data.id;

      // Step 2: Read content by ID
      const getRequest = new NextRequest(
        `http://localhost:3000/api/content/${contentId}`,
        {
          method: "GET",
        },
      );

      const getResponse = await GetById(getRequest, {
        params: { id: contentId },
      });
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getData.success).toBe(true);
      expect(getData.data.id).toBe(contentId);
      expect(getData.data.title).toBe(createPayload.title);

      // Step 3: Update content
      const updatePayload = {
        title: "Updated Integration Test Article",
        content: "<p>This content has been updated.</p>",
        excerpt: "Updated excerpt",
        tags: ["testing", "integration", "updated"],
      };

      const updateRequest = new NextRequest(
        `http://localhost:3000/api/content/${contentId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(updatePayload),
        },
      );

      const updateResponse = await PUT(updateRequest, {
        params: { id: contentId },
      });
      const updateData = await updateResponse.json();

      expect(updateResponse.status).toBe(200);
      expect(updateData.success).toBe(true);
      expect(updateData.data.title).toBe(updatePayload.title);
      expect(updateData.data.content).toBe(updatePayload.content);
      expect(updateData.data.version).toBe(2);

      // Step 4: Publish content
      const publishRequest = new NextRequest(
        `http://localhost:3000/api/content/${contentId}/publish`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      const publishResponse = await Publish(publishRequest, {
        params: { id: contentId },
      });
      const publishData = await publishResponse.json();

      expect(publishResponse.status).toBe(200);
      expect(publishData.success).toBe(true);
      expect(publishData.data.status).toBe("published");
      expect(publishData.data.publishedAt).toBeDefined();

      // Step 5: Verify published content is retrievable
      const getPublishedRequest = new NextRequest(
        `http://localhost:3000/api/content/${contentId}`,
        {
          method: "GET",
        },
      );

      const getPublishedResponse = await GetById(getPublishedRequest, {
        params: { id: contentId },
      });
      const getPublishedData = await getPublishedResponse.json();

      expect(getPublishedResponse.status).toBe(200);
      expect(getPublishedData.data.status).toBe("published");

      // Step 6: Delete content
      const deleteRequest = new NextRequest(
        `http://localhost:3000/api/content/${contentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      const deleteResponse = await DELETE(deleteRequest, {
        params: { id: contentId },
      });
      const deleteData = await deleteResponse.json();

      expect(deleteResponse.status).toBe(200);
      expect(deleteData.success).toBe(true);

      // Step 7: Verify content is deleted
      const getDeletedRequest = new NextRequest(
        `http://localhost:3000/api/content/${contentId}`,
        {
          method: "GET",
        },
      );

      const getDeletedResponse = await GetById(getDeletedRequest, {
        params: { id: contentId },
      });
      const getDeletedData = await getDeletedResponse.json();

      expect(getDeletedResponse.status).toBe(404);
      expect(getDeletedData.success).toBe(false);
    });

    it("should maintain version history through updates", async () => {
      // Create initial content
      const createPayload = {
        title: "Version Test Article",
        slug: "version-test-article",
        content: "<p>Version 1</p>",
        type: "article",
        status: "draft",
      };

      const createRequest = new NextRequest(
        "http://localhost:3000/api/content",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(createPayload),
        },
      );

      const createResponse = await POST(createRequest);
      const createData = await createResponse.json();
      contentId = createData.data.id;

      expect(createData.data.version).toBe(1);

      // Update multiple times
      for (let i = 2; i <= 5; i++) {
        const updateRequest = new NextRequest(
          `http://localhost:3000/api/content/${contentId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              content: `<p>Version ${i}</p>`,
            }),
          },
        );

        const updateResponse = await PUT(updateRequest, {
          params: { id: contentId },
        });
        const updateData = await updateResponse.json();

        expect(updateData.data.version).toBe(i);
      }

      // Verify version history exists
      const versions = await prisma.contentVersion.findMany({
        where: { contentId },
        orderBy: { version: "asc" },
      });

      expect(versions).toHaveLength(5);
      expect(versions[0].version).toBe(1);
      expect(versions[4].version).toBe(5);
    });

    it("should enforce unique slug constraint", async () => {
      // Create first content
      const payload1 = {
        title: "First Article",
        slug: "unique-slug-test",
        content: "<p>First article</p>",
        type: "article",
      };

      const request1 = new NextRequest("http://localhost:3000/api/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload1),
      });

      const response1 = await POST(request1);
      expect(response1.status).toBe(201);

      // Try to create second content with same slug
      const payload2 = {
        title: "Second Article",
        slug: "unique-slug-test",
        content: "<p>Second article</p>",
        type: "article",
      };

      const request2 = new NextRequest("http://localhost:3000/api/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload2),
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(409);
      expect(data2.success).toBe(false);
      expect(data2.error).toContain("Slug already exists");
    });

    it("should list content with pagination", async () => {
      // Create multiple content items
      const contentItems = [];
      for (let i = 1; i <= 15; i++) {
        const payload = {
          title: `Article ${i}`,
          slug: `article-${i}`,
          content: `<p>Content ${i}</p>`,
          type: "article",
          status: i % 2 === 0 ? "published" : "draft",
        };

        const request = new NextRequest("http://localhost:3000/api/content", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        });

        const response = await POST(request);
        const data = await response.json();
        contentItems.push(data.data);
      }

      // Test pagination - Page 1
      const page1Request = new NextRequest(
        "http://localhost:3000/api/content?page=1&limit=10",
        {
          method: "GET",
        },
      );

      const page1Response = await GET(page1Request);
      const page1Data = await page1Response.json();

      expect(page1Response.status).toBe(200);
      expect(page1Data.data.items).toHaveLength(10);
      expect(page1Data.data.page).toBe(1);
      expect(page1Data.data.total).toBe(15);
      expect(page1Data.data.totalPages).toBe(2);

      // Test pagination - Page 2
      const page2Request = new NextRequest(
        "http://localhost:3000/api/content?page=2&limit=10",
        {
          method: "GET",
        },
      );

      const page2Response = await GET(page2Request);
      const page2Data = await page2Response.json();

      expect(page2Response.status).toBe(200);
      expect(page2Data.data.items).toHaveLength(5);
      expect(page2Data.data.page).toBe(2);
    });

    it("should filter content by status", async () => {
      // Create mixed status content
      const statuses = ["draft", "published", "draft", "published", "archived"];

      for (let i = 0; i < statuses.length; i++) {
        const payload = {
          title: `${statuses[i]} Article ${i}`,
          slug: `${statuses[i]}-article-${i}`,
          content: `<p>Content ${i}</p>`,
          type: "article",
          status: statuses[i],
        };

        const request = new NextRequest("http://localhost:3000/api/content", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        });

        await POST(request);
      }

      // Filter by published
      const publishedRequest = new NextRequest(
        "http://localhost:3000/api/content?status=published",
        {
          method: "GET",
        },
      );

      const publishedResponse = await GET(publishedRequest);
      const publishedData = await publishedResponse.json();

      expect(publishedResponse.status).toBe(200);
      expect(publishedData.data.items).toHaveLength(2);
      publishedData.data.items.forEach((item: any) => {
        expect(item.status).toBe("published");
      });
    });
  });

  describe("Content Validation", () => {
    it("should reject content without required fields", async () => {
      const invalidPayload = {
        title: "Test",
        // Missing slug and content
      };

      const request = new NextRequest("http://localhost:3000/api/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
    });

    it("should reject invalid slug format", async () => {
      const invalidPayload = {
        title: "Test Article",
        slug: "Invalid Slug With Spaces!",
        content: "<p>Test</p>",
      };

      const request = new NextRequest("http://localhost:3000/api/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("Authorization & Permissions", () => {
    it("should reject unauthenticated requests", async () => {
      const payload = {
        title: "Test Article",
        slug: "test-article",
        content: "<p>Test</p>",
      };

      const request = new NextRequest("http://localhost:3000/api/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // No Authorization header
        },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Authentication required");
    });

    it("should reject invalid tokens", async () => {
      const payload = {
        title: "Test Article",
        slug: "test-article",
        content: "<p>Test</p>",
      };

      const request = new NextRequest("http://localhost:3000/api/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid_token_here",
        },
        body: JSON.stringify(payload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });
});
