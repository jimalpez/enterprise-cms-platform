import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../../../lib/prisma";
import bcrypt from "bcryptjs";

describe("Login API Integration Tests", () => {
  let testUserId: string;
  const testEmail = "integration-test@example.com";
  const testPassword = "TestPassword123!";

  beforeAll(async () => {
    // Create test user in database
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Integration Test User",
        password: hashedPassword,
        role: "editor",
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.delete({ where: { id: testUserId } });
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
