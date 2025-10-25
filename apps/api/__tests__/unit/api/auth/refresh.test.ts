// apps/api/app/api/auth/refresh/route.test.ts
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { POST } from "../../../../app/api/auth/refresh/route";
import { NextRequest } from "next/server";
import {
  verifyRefreshToken,
  generateAuthTokens,
  revokeRefreshToken,
  getUserPermissions,
} from "@/lib/auth";
import { validateRequest } from "@/lib/validation";
import { UserRole } from "@prisma/client";

// Mock all dependencies
vi.mock("@/lib/auth", () => ({
  verifyRefreshToken: vi.fn(),
  generateAuthTokens: vi.fn(),
  revokeRefreshToken: vi.fn(),
  getUserPermissions: vi.fn(),
}));

vi.mock("@/lib/validation", () => ({
  validateRequest: vi.fn(),
  refreshTokenSchema: {},
}));

describe("POST /api/auth/refresh", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    role: UserRole.author,
    password: "$2b$10$hashedPassword",
    emailVerified: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOldRefreshToken = "old_refresh_token_abc123";
  const mockNewTokens = {
    accessToken: "new_access_token_xyz789",
    refreshToken: "new_refresh_token_def456",
  };

  const mockPermissions = ["read:own", "write:own"];

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Default successful mocks
    (validateRequest as Mock).mockResolvedValue({
      success: true,
      data: { refreshToken: mockOldRefreshToken },
    });
  });

  // Helper function to create mock request
  const createMockRequest = (body: any) => {
    return {
      headers: {
        get: vi.fn(() => null),
      },
      json: vi.fn().mockResolvedValue(body),
    } as unknown as NextRequest;
  };

  describe("Successful Token Refresh", () => {
    it("should refresh tokens successfully with valid refresh token", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
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
        permissions: mockPermissions,
      });

      expect(data.data.accessToken).toBe(mockNewTokens.accessToken);
      expect(data.data.refreshToken).toBe(mockNewTokens.refreshToken);
    });

    it("should call all required functions in correct order", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      await POST(request);

      // Assert - Verify call order and arguments
      expect(validateRequest).toHaveBeenCalled();
      expect(verifyRefreshToken).toHaveBeenCalledWith(mockOldRefreshToken);
      expect(revokeRefreshToken).toHaveBeenCalledWith(mockOldRefreshToken);
      expect(generateAuthTokens).toHaveBeenCalledWith(mockUser);
      expect(getUserPermissions).toHaveBeenCalledWith(mockUser.role);

      // Verify revokeRefreshToken is called before generateAuthTokens
      const revokeCallOrder = (revokeRefreshToken as Mock).mock
        .invocationCallOrder[0];
      const generateCallOrder = (generateAuthTokens as Mock).mock
        .invocationCallOrder[0];
      expect(revokeCallOrder).toBeLessThan(generateCallOrder);
    });

    it("should revoke old refresh token before generating new ones", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      await POST(request);

      // Assert
      expect(revokeRefreshToken).toHaveBeenCalledWith(mockOldRefreshToken);
      expect(generateAuthTokens).toHaveBeenCalledAfter(
        revokeRefreshToken as Mock,
      );
    });

    it("should return new tokens different from old token", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(data.data.refreshToken).not.toBe(mockOldRefreshToken);
      expect(data.data.refreshToken).toBe(mockNewTokens.refreshToken);
      expect(data.data.accessToken).toBe(mockNewTokens.accessToken);
    });
  });

  describe("Validation Errors", () => {
    it("should return 400 for invalid request body", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: false,
        errors: {
          refreshToken: "Refresh token is required",
        },
      });

      const request = createMockRequest({
        refreshToken: "",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toEqual({
        refreshToken: "Refresh token is required",
      });

      // Verify no further processing
      expect(verifyRefreshToken).not.toHaveBeenCalled();
    });

    it("should require refreshToken field", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: false,
        errors: {
          refreshToken: "Refresh token is required",
        },
      });

      const request = createMockRequest({});

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should validate refreshToken format", async () => {
      // Arrange
      (validateRequest as Mock).mockResolvedValue({
        success: false,
        errors: {
          refreshToken: "Invalid refresh token format",
        },
      });

      const request = createMockRequest({
        refreshToken: "invalid-token",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("Invalid or Expired Tokens", () => {
    it("should return 401 for invalid refresh token", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(null);

      const request = createMockRequest({
        refreshToken: "invalid_token",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid or expired refresh token");

      // Verify no token generation or revocation
      expect(revokeRefreshToken).not.toHaveBeenCalled();
      expect(generateAuthTokens).not.toHaveBeenCalled();
    });

    it("should return 401 for expired refresh token", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(null);

      const request = createMockRequest({
        refreshToken: "expired_token",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid or expired refresh token");
    });

    it("should return 401 for revoked refresh token", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(null);

      const request = createMockRequest({
        refreshToken: "revoked_token",
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("should not generate new tokens for invalid token", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(null);

      const request = createMockRequest({
        refreshToken: "invalid_token",
      });

      // Act
      await POST(request);

      // Assert
      expect(generateAuthTokens).not.toHaveBeenCalled();
      expect(revokeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe("Token Revocation", () => {
    it("should revoke old token before generating new ones", async () => {
      // Arrange
      const revokeCalls: string[] = [];
      const generateCalls: any[] = [];

      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockImplementation((token) => {
        revokeCalls.push(token);
        return Promise.resolve();
      });
      (generateAuthTokens as Mock).mockImplementation((user) => {
        generateCalls.push(user);
        return Promise.resolve(mockNewTokens);
      });
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      await POST(request);

      // Assert
      expect(revokeCalls.length).toBe(1);
      expect(generateCalls.length).toBe(1);
      expect(revokeCalls[0]).toBe(mockOldRefreshToken);
    });

    it("should pass correct token to revokeRefreshToken", async () => {
      // Arrange
      const customToken = "custom_refresh_token_789";
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: { refreshToken: customToken },
      });
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: customToken,
      });

      // Act
      await POST(request);

      // Assert
      expect(revokeRefreshToken).toHaveBeenCalledWith(customToken);
    });
  });

  describe("Token Generation", () => {
    it("should generate new tokens for verified user", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      await POST(request);

      // Assert
      expect(generateAuthTokens).toHaveBeenCalledWith(mockUser);
    });

    it("should get user permissions based on role", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      await POST(request);

      // Assert
      expect(getUserPermissions).toHaveBeenCalledWith(mockUser.role);
    });

    it("should generate both access and refresh tokens", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.refreshToken).toBeDefined();
      expect(data.data.accessToken).toBe(mockNewTokens.accessToken);
      expect(data.data.refreshToken).toBe(mockNewTokens.refreshToken);
    });
  });

  describe("Response Structure", () => {
    it("should return correct user data structure", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
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
          accessToken: mockNewTokens.accessToken,
          refreshToken: mockNewTokens.refreshToken,
        },
      });

      // Verify password is NOT included in response
      expect(data.data.user).not.toHaveProperty("password");
    });

    it("should not expose password in response", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      const responseString = JSON.stringify(data);
      expect(responseString).not.toContain("$2b$10$");
      expect(data.data.user.password).toBeUndefined();
    });

    it("should include permissions in user data", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue([
        "read:own",
        "write:own",
        "delete:own",
      ]);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
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

    it("should handle empty permissions array", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue([]);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.user.permissions).toEqual([]);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when verifyRefreshToken throws error", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockRejectedValue(
        new Error("Token verification failed"),
      );

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("An error occurred while refreshing token");
    });

    it("should return 500 when revokeRefreshToken throws error", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockRejectedValue(
        new Error("Failed to revoke token"),
      );

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("An error occurred while refreshing token");
    });

    it("should return 500 when generateAuthTokens throws error", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockRejectedValue(
        new Error("Token generation failed"),
      );

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it("should log errors to console", async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockError = new Error("Unexpected error");

      (verifyRefreshToken as Mock).mockRejectedValue(mockError);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      await POST(request);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Refresh token error:",
        mockError,
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle malformed JSON gracefully", async () => {
      // Arrange
      const request = {
        headers: {
          get: vi.fn(() => null),
        },
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      } as unknown as NextRequest;

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("An error occurred while refreshing token");
    });
  });

  describe("Security", () => {
    it("should not allow reuse of revoked token", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act - First refresh
      await POST(request);

      // Assert
      expect(revokeRefreshToken).toHaveBeenCalledWith(mockOldRefreshToken);

      // Simulate second attempt with same token
      (verifyRefreshToken as Mock).mockResolvedValue(null); // Token now invalid

      const request2 = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(401);
      expect(data2.error).toBe("Invalid or expired refresh token");
    });

    it("should verify token before revoking", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(null);

      const request = createMockRequest({
        refreshToken: "invalid_token",
      });

      // Act
      await POST(request);

      // Assert - Should not revoke invalid token
      expect(revokeRefreshToken).not.toHaveBeenCalled();
    });

    it("should use secure token generation", async () => {
      // Arrange
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      await POST(request);

      // Assert
      expect(generateAuthTokens).toHaveBeenCalledWith(mockUser);
    });
  });

  describe("Edge Cases", () => {
    it("should handle user with different roles", async () => {
      // Arrange
      const adminUser = { ...mockUser, role: UserRole.admin };
      const adminPermissions = ["read:all", "write:all", "delete:all"];

      (verifyRefreshToken as Mock).mockResolvedValue(adminUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(adminPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.user.role).toBe(UserRole.admin);
      expect(data.data.user.permissions).toEqual(adminPermissions);
    });

    it("should handle very long refresh tokens", async () => {
      // Arrange
      const longToken = "a".repeat(500);
      (validateRequest as Mock).mockResolvedValue({
        success: true,
        data: { refreshToken: longToken },
      });
      (verifyRefreshToken as Mock).mockResolvedValue(mockUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: longToken,
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(verifyRefreshToken).toHaveBeenCalledWith(longToken);
    });

    it("should handle user with null emailVerified", async () => {
      // Arrange
      const unverifiedUser = { ...mockUser, emailVerified: null };
      (verifyRefreshToken as Mock).mockResolvedValue(unverifiedUser);
      (revokeRefreshToken as Mock).mockResolvedValue(undefined);
      (generateAuthTokens as Mock).mockResolvedValue(mockNewTokens);
      (getUserPermissions as Mock).mockReturnValue(mockPermissions);

      const request = createMockRequest({
        refreshToken: mockOldRefreshToken,
      });

      // Act
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.user.emailVerified).toBeUndefined();
    });
  });
});
