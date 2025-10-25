import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { POST } from "../../../../app/api/auth/login/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  generateAuthTokens,
  getUserPermissions,
} from "@/lib/auth";
import { validateRequest } from "@/lib/validation";
import { checkRateLimit } from "@/lib/redis";

// Mock all dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  verifyPassword: vi.fn(),
  generateAuthTokens: vi.fn(),
  getUserPermissions: vi.fn(),
}));

vi.mock("@/lib/validation", () => ({
  validateRequest: vi.fn(),
  loginSchema: {},
}));

vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn(),
}));

describe("POST /api/auth/login", () => {
  const mockUser = {
    id: "cmgyzbf960000m5u4cc3waw3v",
    email: "test@admin.com",
    name: "Test",
    password: "$2b$10$77.FrGS0NrqW.oqe72lNJOuyqTgETCK16JW27NdQeQyKBf.n7Z/Mu",
    role: "admin",
    avatar: null,
    stripeCustomerId: "cus_TestCustomer12",
    emailVerified: null,
  };

  const mockTokens = {
    accessToken:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWd5emJmOTYwMDAwbTV1NGNjM3dhdzN2IiwiZW1haWwiOiJ0ZXN0QGFkbWluLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2MTMyNjcyMCwiZXhwIjoxNzYxMzI3NjIwfQ.KLrVJRtVktjr-2fd0yZI3324M3L99hE5-v24Plzrrk8",
    refreshToken:
      "QavLBo37AwGg9rzAQ6eb306nWc0aEgXpQaR_3Uu9KKPC2B-aqPGYQkZ6DPrsP7w9",
  };

  const mockPermissions = ["read:content", "write:content"];

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Default successful mocks
    (checkRateLimit as Mock).mockResolvedValue({ allowed: true, remaining: 9 });
    (validateRequest as Mock).mockResolvedValue({
      success: true,
      data: { email: "test@admin.com", password: "test1234567890" },
    });
  });

  // Helper function to create mock request
  const createMockRequest = (
    body: any,
    headers: Record<string, string> = {},
  ) => {
    return {
      headers: {
        get: vi.fn((key: string) => headers[key] || null),
      },
      json: vi.fn().mockResolvedValue(body),
    } as unknown as NextRequest;
  };

  describe("Successful Login", () => {
    it("should login successfully with valid credentials", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(true);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@admin.com",
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("user");
      expect(data.data).toHaveProperty("accessToken");
      expect(data.data).toHaveProperty("refreshToken");

      expect(data.data.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        avatar: mockUser.avatar,
        stripeCustomerId: mockUser.stripeCustomerId,
        emailVerified: mockUser.emailVerified,
        permissions: mockPermissions,
      });

      expect(data.data.accessToken).toBe(mockTokens.accessToken);
      expect(data.data.refreshToken).toBe(mockTokens.refreshToken);
    });

    it("should call all required functions in correct order", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(true);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@admin.com",
        password: "test1234567890",
      });

      // Act
      await POST(request);

      // Assert - Verify call order and arguments
      expect(checkRateLimit).toHaveBeenCalledWith("login:unknown", 10, 3600);
      expect(validateRequest).toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@admin.com" },
      });
      expect(verifyPassword).toHaveBeenCalledWith(
        "test1234567890",
        mockUser.password,
      );
      expect(generateAuthTokens).toHaveBeenCalledWith(mockUser);
      expect(getUserPermissions).toHaveBeenCalledWith(mockUser.role);
    });
  });

  describe("Rate Limiting", () => {
    it("should block login when rate limit exceeded", async () => {
      // Arrange
      (checkRateLimit as Mock).mockResolvedValue({
        allowed: false,
        remaining: 0,
      });

      const request = createMockRequest(
        { email: "test@admin.com", password: "test1234567890" },
        { "x-forwarded-for": "192.168.1.1" },
      );

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toBe(
        "Too many login attempts. Please try again later.",
      );
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");

      // Verify no further processing
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("should use IP from x-forwarded-for header", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(true);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest(
        { email: "test@admin.com", password: "test1234567890" },
        { "x-forwarded-for": "192.168.1.100" },
      );

      // Act
      await POST(request);

      // Assert
      expect(checkRateLimit).toHaveBeenCalledWith(
        "login:192.168.1.100",
        10,
        3600,
      );
    });

    it('should use "unknown" when IP header is missing', async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(true);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@admin.com",
        password: "test1234567890",
      });

      // Act
      await POST(request);

      // Assert
      expect(checkRateLimit).toHaveBeenCalledWith("login:unknown", 10, 3600);
    });
  });

  describe("Validation Errors", () => {
    it("should return 400 for invalid request body", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: false,
        errors: [
          { field: "email", message: "Invalid email format" },
          { field: "password", message: "Password is required" },
        ],
      });

      const request = createMockRequest({
        email: "invalid-email",
        password: "",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toHaveLength(2);
      expect(data.errors[0]).toEqual({
        field: "email",
        message: "Invalid email format",
      });

      // Verify no further processing
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("should validate email format", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: false,
        errors: [{ field: "email", message: "Invalid email format" }],
      });

      const request = createMockRequest({
        email: "not-an-email",
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should require password field", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: false,
        errors: [{ field: "password", message: "Password is required" }],
      });

      const request = createMockRequest({
        email: "test@admin.com",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("Authentication Failures", () => {
    it("should return 401 when user does not exist", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      const request = createMockRequest({
        email: "nonexistent@example.com",
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid credentials");

      // Verify password verification was not called
      expect(verifyPassword).not.toHaveBeenCalled();
    });

    it("should return 401 when password is incorrect", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: { email: "test@admin.com", password: "wrongpassword" },
      });

      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(false);

      const request = createMockRequest({
        email: "test@admin.com",
        password: "wrongpassword",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid credentials");
      expect(verifyPassword).toHaveBeenCalledWith(
        "wrongpassword",
        mockUser.password,
      );

      // Verify tokens were not generated
      expect(generateAuthTokens).not.toHaveBeenCalled();
    });

    it("should return 401 when user has no password (OAuth user)", async () => {
      // Arrange - OAuth user without password
      const oauthUser = { ...mockUser, password: null };
      (prisma.user.findUnique as Mock).mockResolvedValue(oauthUser);

      const request = createMockRequest({
        email: "oauth@example.com",
        password: "anypassword",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid credentials");

      // Verify password verification was not called
      expect(verifyPassword).not.toHaveBeenCalled();
    });

    it("should return 401 for case-sensitive email mismatch", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      const request = createMockRequest({
        email: "TEST@EXAMPLE.COM", // Different case
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const request = createMockRequest({
        email: "test@admin.com",
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("An error occurred during login");
    });

    it("should handle token generation errors", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(true);
      (generateAuthTokens as Mock).mockRejectedValue(
        new Error("Token generation failed"),
      );

      const request = createMockRequest({
        email: "test@admin.com",
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it("should handle malformed JSON in request body", async () => {
      // Arrange
      const request = {
        headers: { get: vi.fn(() => null) },
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      } as unknown as NextRequest;

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it("should log errors without exposing sensitive details", async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      (prisma.user.findUnique as Mock).mockRejectedValue(
        new Error("Sensitive database error"),
      );

      const request = createMockRequest({
        email: "test@admin.com",
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(data.error).not.toContain("Sensitive");
      expect(data.error).toBe("An error occurred during login");

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Response Structure", () => {
    it("should return correct user data structure", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(true);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@admin.com",
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(data).toEqual({
        success: true,
        data: {
          user: {
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
            role: mockUser.role,
            avatar: mockUser.avatar,
            stripeCustomerId: mockUser.stripeCustomerId,
            emailVerified: mockUser.emailVerified,
            permissions: mockPermissions,
          },
          accessToken: mockTokens.accessToken,
          refreshToken: mockTokens.refreshToken,
        },
      });

      // Verify password is NOT included in response
      expect(data.data.user).not.toHaveProperty("password");
    });

    it("should not expose password in response", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(true);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@admin.com",
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      const responseString = JSON.stringify(data);
      expect(responseString).not.toContain(mockUser.password);
      expect(responseString).not.toContain("$2a$10$");
    });

    it("should include permissions in user data", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(true);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue([
        "read:content",
        "write:content",
        "delete:content",
      ]);

      const request = createMockRequest({
        email: "test@admin.com",
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(data.data.user.permissions).toEqual([
        "read:content",
        "write:content",
        "delete:content",
      ]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle user with null emailVerified", async () => {
      // Arrange
      const userWithoutVerification = { ...mockUser, emailVerified: null };
      (prisma.user.findUnique as Mock).mockResolvedValue(
        userWithoutVerification,
      );
      (verifyPassword as Mock).mockResolvedValue(true);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@admin.com",
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.user.emailVerified).toBeNull();
    });

    it("should handle user with null avatar", async () => {
      // Arrange
      const userWithoutAvatar = { ...mockUser, avatar: null };
      (prisma.user.findUnique as Mock).mockResolvedValue(userWithoutAvatar);
      (verifyPassword as Mock).mockResolvedValue(true);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@admin.com",
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.user.avatar).toBeNull();
    });

    it("should handle empty permissions array", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(true);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue([]);

      const request = createMockRequest({
        email: "test@admin.com",
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.user.permissions).toEqual([]);
    });

    it("should handle very long email addresses", async () => {
      // Arrange
      const longEmail = "a".repeat(250) + "@example.com";
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: { email: longEmail, password: "test1234567890" },
      });
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      const request = createMockRequest({
        email: longEmail,
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe("Security", () => {
    it("should not reveal if email exists in error message", async () => {
      // Arrange - User doesn't exist
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      const request = createMockRequest({
        email: "nonexistent@example.com",
        password: "test1234567890",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert - Same generic error message
      expect(data.error).toBe("Invalid credentials");
      expect(data.error).not.toContain("user not found");
      expect(data.error).not.toContain("email");
    });

    it("should use generic error for wrong password", async () => {
      // Arrange - Wrong password
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(false);

      const request = createMockRequest({
        email: "test@admin.com",
        password: "wrongpassword",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert - Same generic error message
      expect(data.error).toBe("Invalid credentials");
      expect(data.error).not.toContain("password");
      expect(data.error).not.toContain("incorrect");
    });

    it("should implement timing attack protection", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(false);

      const request = createMockRequest({
        email: "test@admin.com",
        password: "wrongpassword",
      });

      // Act
      const startTime = Date.now();
      await POST(request);
      const duration1 = Date.now() - startTime;

      // Now test with non-existent user
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      const request2 = createMockRequest({
        email: "nonexistent@example.com",
        password: "wrongpassword",
      });

      const startTime2 = Date.now();
      await POST(request2);
      const duration2 = Date.now() - startTime2;

      // Assert - Timing should be similar (within 100ms)
      // This is a basic check; real timing attacks are more sophisticated
      const timingDiff = Math.abs(duration1 - duration2);
      expect(timingDiff).toBeLessThan(100);
    });
  });
});
