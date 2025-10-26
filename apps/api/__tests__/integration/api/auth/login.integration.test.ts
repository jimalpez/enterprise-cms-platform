import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../../../lib/prisma";
import bcrypt from "bcryptjs";

describe("Login API Integration Tests", () => {
  let testUserId: string;
  const testEmail = "test@admin.com";
  const testPassword = "test1234567890";

  beforeAll(async () => {
    // Clean up any existing test user first
    await prisma.user.deleteMany({ where: { email: testEmail } });

    // Create test user in database
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Test",
        password: hashedPassword,
        role: "admin",
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } });
    }
    await prisma.$disconnect();
  });

  it("should login with real database", async () => {
    const response = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.user.email).toBe(testEmail);
    expect(data.data).toHaveProperty("accessToken");
    expect(data.data).toHaveProperty("refreshToken");
  });

  it("should fail with wrong password", async () => {
    const response = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "WrongPassword123!",
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Invalid credentials");
  });
});
