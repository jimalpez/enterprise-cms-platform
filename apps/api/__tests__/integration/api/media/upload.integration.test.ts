import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

// Import your upload route handler
import { POST as UploadMedia } from "@/app/api/media/upload/route";
import { GET, DELETE } from "@/app/api/media/[id]/route";

describe("Upload Integration Tests", () => {
  let authToken: string;
  let userId: string;
  let testUser: any;
  let uploadedMediaIds: string[] = [];

  // Test file paths
  const testFilesDir = path.join(__dirname, "../fixtures");
  const uploadDir = path.join(process.cwd(), "public/uploads");

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: "uploadtest@example.com",
        password: "hashedPassword123",
        name: "Upload Test User",
        role: "editor",
      },
    });

    userId = testUser.id;

    // Generate auth token
    const { generateAccessToken } = await import("@/lib/auth");
    authToken = generateAccessToken({
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role,
    });

    // Ensure upload directory exists
    await fs.mkdir(uploadDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      // Delete uploaded files
      for (const mediaId of uploadedMediaIds) {
        try {
          const media = await prisma.media.findUnique({
            where: { id: mediaId },
          });

          if (media?.url) {
            const filePath = path.join(process.cwd(), "public", media.url);
            await fs.unlink(filePath).catch(() => {});
          }
        } catch (error) {
          // Ignore errors during cleanup
        }
      }

      // Delete media records
      if (userId) {
        await prisma.media.deleteMany({
          where: { uploadedBy: userId },
        });

        // Delete test user
        await prisma.user
          .delete({
            where: { id: userId },
          })
          .catch(() => {});
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    } finally {
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    uploadedMediaIds = [];
  });

  describe("Image Upload", () => {
    it("should upload image successfully", async () => {
      // Create a test image buffer
      const imageBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      // Create FormData
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: "image/png" });
      const file = new File([blob], "test-image.png", { type: "image/png" });
      formData.append("file", file);

      const request = new NextRequest(
        "http://localhost:3000/api/media/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        },
      );

      const response = await UploadMedia(request);
      const data = await response.json();

      // Debug logging
      console.log("Upload response status:", response.status);
      console.log("Upload response data:", JSON.stringify(data, null, 2));

      // Check if upload failed
      if (!data.success) {
        console.error("Upload failed:", data.error);
        throw new Error(`Upload failed: ${data.error}`);
      }

      // Accept both 200 and 201 as success
      expect([200, 201]).toContain(response.status);
      expect(data.success).toBe(true);

      // The API should return data in data.data
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      expect(data.data.url).toBeDefined();
      expect(data.data.filename).toBe("test-image.png");
      expect(data.data.mimetype).toBe("image/png");

      uploadedMediaIds.push(data.data.id);

      // Verify file exists in database
      const media = await prisma.media.findUnique({
        where: { id: data.data.id },
      });

      expect(media).toBeDefined();
      expect(media?.uploadedBy).toBe(userId);
    });

    it("should handle multiple image uploads", async () => {
      const uploadPromises = [];

      for (let i = 0; i < 3; i++) {
        const imageBuffer = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          "base64",
        );

        const formData = new FormData();
        const blob = new Blob([imageBuffer], { type: "image/png" });
        const file = new File([blob], `test-image-${i}.png`, {
          type: "image/png",
        });
        formData.append("file", file);

        const request = new NextRequest(
          "http://localhost:3000/api/media/upload",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
            body: formData,
          },
        );

        uploadPromises.push(UploadMedia(request));
      }

      const responses = await Promise.all(uploadPromises);
      const dataResults = await Promise.all(responses.map((r) => r.json()));

      expect(responses).toHaveLength(3);
      responses.forEach((response, index) => {
        // Accept both 200 and 201
        expect([200, 201]).toContain(response.status);
        expect(dataResults[index].success).toBe(true);
        const mediaData = dataResults[index].data || dataResults[index];
        uploadedMediaIds.push(mediaData.id);
      });
    });

    it("should generate unique filenames for duplicate uploads", async () => {
      const imageBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      // First upload
      const formData1 = new FormData();
      const blob1 = new Blob([imageBuffer], { type: "image/png" });
      const file1 = new File([blob1], "duplicate.png", { type: "image/png" });
      formData1.append("file", file1);

      const request1 = new NextRequest(
        "http://localhost:3000/api/media/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData1,
        },
      );

      const response1 = await UploadMedia(request1);
      const data1 = await response1.json();

      // Debug logging
      console.log("First upload:", data1);

      expect(data1.success).toBe(true);
      expect(data1.data).toBeDefined();
      expect(data1.data.id).toBeDefined();
      uploadedMediaIds.push(data1.data.id);

      // Second upload
      const formData2 = new FormData();
      const blob2 = new Blob([imageBuffer], { type: "image/png" });
      const file2 = new File([blob2], "duplicate.png", { type: "image/png" });
      formData2.append("file", file2);

      const request2 = new NextRequest(
        "http://localhost:3000/api/media/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData2,
        },
      );

      const response2 = await UploadMedia(request2);
      const data2 = await response2.json();

      // Debug logging
      console.log("Second upload:", data2);

      expect(data2.success).toBe(true);
      expect(data2.data).toBeDefined();
      expect(data2.data.id).toBeDefined();
      uploadedMediaIds.push(data2.data.id);

      // Filenames should be different (one should have a timestamp/hash added)
      expect(data1.data.filename).not.toBe(data2.data.filename);
    });
  });

  describe("File Validation", () => {
    it("should reject files exceeding size limit", async () => {
      // Create a large buffer (15MB)
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024);

      const formData = new FormData();
      const blob = new Blob([largeBuffer], { type: "image/png" });
      const file = new File([blob], "large-file.png", { type: "image/png" });
      formData.append("file", file);

      const request = new NextRequest(
        "http://localhost:3000/api/media/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        },
      );

      const response = await UploadMedia(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("size");
    });

    it("should reject invalid file types", async () => {
      const textBuffer = Buffer.from("This is a text file");

      const formData = new FormData();
      const blob = new Blob([textBuffer], { type: "text/plain" });
      const file = new File([blob], "test.txt", { type: "text/plain" });
      formData.append("file", file);

      const request = new NextRequest(
        "http://localhost:3000/api/media/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        },
      );

      const response = await UploadMedia(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid file type");
    });

    it("should reject upload without file", async () => {
      const formData = new FormData();
      // No file added

      const request = new NextRequest(
        "http://localhost:3000/api/media/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        },
      );

      const response = await UploadMedia(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("No file");
    });
  });

  describe("Media Retrieval and Deletion", () => {
    it("should retrieve uploaded media by ID", async () => {
      const imageBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: "image/png" });
      const file = new File([blob], "retrieve-test.png", { type: "image/png" });
      formData.append("file", file);

      const uploadRequest = new NextRequest(
        "http://localhost:3000/api/media/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        },
      );

      const uploadResponse = await UploadMedia(uploadRequest);
      const uploadData = await uploadResponse.json();

      // Debug logging
      console.log("Upload for retrieve test:", uploadData);

      expect(uploadData.success).toBe(true);
      expect(uploadData.data).toBeDefined();

      const mediaId = uploadData.data.id;
      expect(mediaId).toBeDefined();
      uploadedMediaIds.push(mediaId);

      // Retrieve the media
      const getRequest = new NextRequest(
        `http://localhost:3000/api/media/${mediaId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      const getResponse = await GET(getRequest, { params: { id: mediaId } });
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getData.success).toBe(true);
      expect(getData.data.id).toBe(mediaId);
      expect(getData.data.filename).toBe("retrieve-test.png");
    });

    it("should delete uploaded media", async () => {
      const imageBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: "image/png" });
      const file = new File([blob], "delete-test.png", { type: "image/png" });
      formData.append("file", file);

      const uploadRequest = new NextRequest(
        "http://localhost:3000/api/media/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        },
      );

      const uploadResponse = await UploadMedia(uploadRequest);
      const uploadData = await uploadResponse.json();

      // Debug logging
      console.log("Upload for delete test:", uploadData);

      expect(uploadData.success).toBe(true);
      expect(uploadData.data).toBeDefined();

      const mediaId = uploadData.data.id;
      expect(mediaId).toBeDefined();

      // Delete the media
      const deleteRequest = new NextRequest(
        `http://localhost:3000/api/media/${mediaId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      const deleteResponse = await DELETE(deleteRequest, {
        params: { id: mediaId },
      });
      const deleteData = await deleteResponse.json();

      expect(deleteResponse.status).toBe(200);
      expect(deleteData.success).toBe(true);

      // Verify media is deleted
      const media = await prisma.media.findUnique({
        where: { id: mediaId },
      });

      expect(media).toBeNull();
    });
  });

  describe("Authorization", () => {
    it("should reject upload without authentication", async () => {
      const imageBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: "image/png" });
      const file = new File([blob], "unauth-test.png", { type: "image/png" });
      formData.append("file", file);

      const request = new NextRequest(
        "http://localhost:3000/api/media/upload",
        {
          method: "POST",
          // No Authorization header
          body: formData,
        },
      );

      const response = await UploadMedia(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      // Accept either error message format
      expect(
        data.error === "Authentication required" ||
          data.error === "Unauthorized" ||
          data.message === "Unauthorized",
      ).toBe(true);
    });
  });
});
