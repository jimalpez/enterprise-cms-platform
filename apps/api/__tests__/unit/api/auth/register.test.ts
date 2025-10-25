// apps/api/app/api/auth/register/route.test.ts
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { POST } from "../../../../app/api/auth/register/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  generateAuthTokens,
  getUserPermissions,
} from "@/lib/auth";
import { validateRequest } from "@/lib/validation";
import { checkRateLimit } from "@/lib/redis";
import { UserRole } from "@prisma/client";

// Mock all dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn(),
  generateAuthTokens: vi.fn(),
  getUserPermissions: vi.fn(),
}));

vi.mock("@/lib/validation", () => ({
  validateRequest: vi.fn(),
  registerSchema: {},
}));

vi.mock("@/lib/redis", () => ({
  checkRateLimit: vi.fn(),
}));

describe("POST /api/auth/register", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    password: "$2b$10$hashedPassword",
    role: UserRole.author,
    emailVerified: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTokens = {
    accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
    refreshToken: "refresh_token_123",
  };

  const mockPermissions = ["read:own", "write:own"];

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Default successful mocks
    (checkRateLimit as Mock).mockResolvedValue({ allowed: true, remaining: 4 });
    (validateRequest as Mock).mockResolvedValue({
      success: true,
      data: {
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      },
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

  describe("Successful Registration", () => {
    it("should register successfully with valid data", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("user");
      expect(data.data).toHaveProperty("accessToken");
      expect(data.data).toHaveProperty("refreshToken");

      expect(data.data.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        permissions: mockPermissions,
      });

      expect(data.data.accessToken).toBe(mockTokens.accessToken);
      expect(data.data.refreshToken).toBe(mockTokens.refreshToken);
    });

    it("should call all required functions in correct order", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      await POST(request);

      // Assert - Verify call order and arguments
      expect(checkRateLimit).toHaveBeenCalledWith("register:unknown", 5, 3600);
      expect(validateRequest).toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
      expect(hashPassword).toHaveBeenCalledWith("Password123!");
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "test@example.com",
          password: "hashed_password",
          name: "Test User",
          role: UserRole.author,
          emailVerified: null,
        },
      });
      expect(generateAuthTokens).toHaveBeenCalledWith(mockUser);
      expect(getUserPermissions).toHaveBeenCalledWith(mockUser.role);
    });

    it("should hash password before storing", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_Password123!");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      await POST(request);

      // Assert
      expect(hashPassword).toHaveBeenCalledWith("Password123!");
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: "hashed_Password123!",
          }),
        }),
      );
    });
  });

  describe("Rate Limiting", () => {
    it("should block registration when rate limit exceeded", async () => {
      // Arrange
      (checkRateLimit as Mock).mockResolvedValue({
        allowed: false,
        remaining: 0,
      });

      const request = createMockRequest(
        {
          email: "test@example.com",
          password: "Password123!",
          name: "Test User",
        },
        { "x-forwarded-for": "192.168.1.1" },
      );

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toBe(
        "Too many registration attempts. Please try again later.",
      );
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");

      // Verify no further processing
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("should use IP from x-forwarded-for header", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest(
        {
          email: "test@example.com",
          password: "Password123!",
          name: "Test User",
        },
        { "x-forwarded-for": "203.0.113.1" },
      );

      // Act
      await POST(request);

      // Assert
      expect(checkRateLimit).toHaveBeenCalledWith(
        "register:203.0.113.1",
        5,
        3600,
      );
    });

    it('should use "unknown" when IP header is missing', async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      await POST(request);

      // Assert
      expect(checkRateLimit).toHaveBeenCalledWith("register:unknown", 5, 3600);
    });
  });

  describe("Validation Errors", () => {
    it("should return 400 for invalid request body", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: false,
        errors: {
          email: "Invalid email format",
          password: "Password must be at least 8 characters",
        },
      });

      const request = createMockRequest({
        email: "invalid-email",
        password: "123",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toEqual({
        email: "Invalid email format",
        password: "Password must be at least 8 characters",
      });

      // Verify no further processing
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("should validate email format", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: false,
        errors: {
          email: "Invalid email format",
        },
      });

      const request = createMockRequest({
        email: "not-an-email",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should require password", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: false,
        errors: {
          password: "Password is required",
        },
      });

      const request = createMockRequest({
        email: "test@example.com",
        password: "",
        name: "Test User",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should require name", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: false,
        errors: {
          name: "Name is required",
        },
      });

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("User Existence Check", () => {
    it("should return 409 when user already exists", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toBe("User with this email already exists");

      // Verify no user creation attempted
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("should proceed when email is available", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "new@example.com",
        password: "Password123!",
        name: "New User",
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(201);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it("should check email case-insensitively", async () => {
      // Arrange
      const mixedCaseEmail = "Test@Example.COM";
      const normalizedEmail = "test@example.com";

      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          email: normalizedEmail, // Validation normalizes to lowercase
          password: "Password123!",
          name: "Test User",
        },
      });
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: mixedCaseEmail,
        password: "Password123!",
        name: "Test User",
      });

      // Act
      await POST(request);

      // Assert - Should use normalized lowercase email
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: normalizedEmail },
      });
    });
  });

  describe("User Creation", () => {
    it("should create user with author role by default", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      await POST(request);

      // Assert
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: UserRole.author,
          }),
        }),
      );
    });

    it("should set emailVerified to null for new users", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      await POST(request);

      // Assert
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emailVerified: null,
          }),
        }),
      );
    });

    it("should store hashed password, not plain text", async () => {
      // Arrange
      const plainPassword = "MySecretPassword123!";
      const hashedPassword = "$2b$10$hashedversion";

      // Mock validateRequest to return the custom password
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          email: "test@example.com",
          password: plainPassword,
          name: "Test User",
        },
      });
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue(hashedPassword);
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: plainPassword,
        name: "Test User",
      });

      // Act
      await POST(request);

      // Assert
      expect(hashPassword).toHaveBeenCalledWith(plainPassword);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: hashedPassword,
          }),
        }),
      );
      // Ensure plain password is not stored
      expect(prisma.user.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: plainPassword,
          }),
        }),
      );
    });
  });

  describe("Token Generation", () => {
    it("should generate auth tokens for new user", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      await POST(request);

      // Assert
      expect(generateAuthTokens).toHaveBeenCalledWith(mockUser);
    });

    it("should get user permissions based on role", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      await POST(request);

      // Assert
      expect(getUserPermissions).toHaveBeenCalledWith(UserRole.author);
    });
  });

  describe("Response Structure", () => {
    it("should return correct user data structure", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
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
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      const responseString = JSON.stringify(data);
      expect(responseString).not.toContain("hashed_password");
      expect(responseString).not.toContain("$2b$10$");
      expect(data.data.user.password).toBeUndefined();
    });

    it("should include permissions in user data", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue([
        "read:own",
        "write:own",
        "delete:own",
      ]);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(data.data.user.permissions).toEqual([
        "read:own",
        "write:own",
        "delete:own",
      ]);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when database error occurs", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("An error occurred during registration");
    });

    it("should log errors to console", async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockError = new Error("Unexpected error");

      (prisma.user.findUnique as Mock).mockRejectedValue(mockError);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      await POST(request);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Registration error:",
        mockError,
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle password hashing failure", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockRejectedValue(new Error("Hashing failed"));

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("should handle user creation failure", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockRejectedValue(
        new Error("Failed to create user"),
      );

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(generateAuthTokens).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle email with special characters", async () => {
      // Arrange
      const specialEmail = "test+special@example.co.uk";
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          email: specialEmail,
          password: "Password123!",
          name: "Test User",
        },
      });
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue({
        ...mockUser,
        email: specialEmail,
      });
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: specialEmail,
        password: "Password123!",
        name: "Test User",
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(201);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: specialEmail },
      });
    });

    it("should handle names with unicode characters", async () => {
      // Arrange
      const unicodeName = "José María González";
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          email: "test@example.com",
          password: "Password123!",
          name: unicodeName,
        },
      });
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue({
        ...mockUser,
        name: unicodeName,
      });
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: unicodeName,
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(data.data.user.name).toBe(unicodeName);
    });

    it("should handle very long names", async () => {
      // Arrange
      const longName = "A".repeat(250);
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: {
          email: "test@example.com",
          password: "Password123!",
          name: longName,
        },
      });
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue({
        ...mockUser,
        name: longName,
      });
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: longName,
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(201);
    });

    it("should handle empty permissions array", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue([]);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(data.data.user.permissions).toEqual([]);
    });
  });

  describe("Security", () => {
    it("should never store plain text password", async () => {
      // Arrange
      const plainPassword = "MyPlainTextPassword123!";
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("$2b$10$hashed");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: plainPassword,
        name: "Test User",
      });

      // Act
      await POST(request);

      // Assert
      const createCall = (prisma.user.create as Mock).mock.calls[0][0];
      expect(createCall.data.password).not.toBe(plainPassword);
      expect(createCall.data.password).toBe("$2b$10$hashed");
    });

    it("should use secure password hashing", async () => {
      // Arrange
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (hashPassword as Mock).mockResolvedValue("hashed_password");
      (prisma.user.create as Mock).mockResolvedValue(mockUser);
      (generateAuthTokens as Mock).mockResolvedValue(mockTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        email: "test@example.com",
        password: "Password123!",
        name: "Test User",
      });

      // Act
      await POST(request);

      // Assert
      expect(hashPassword).toHaveBeenCalledWith("Password123!");
    });
  });
});
