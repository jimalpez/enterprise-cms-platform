import { describe, it, expect, beforeEach, vi, Mock, afterEach } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  generateAuthTokens,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  cleanExpiredTokens,
  getUserPermissions,
  hasPermission,
  extractTokenFromHeader,
  authenticateRequest,
  canModifyResource,
  type JWTPayload,
  type AuthTokens,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("jsonwebtoken");
vi.mock("bcryptjs");
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "refresh_token"),
}));

describe("Auth Library", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    password: "$2b$10$hashedPassword",
    role: UserRole.author,
    avatar: null,
    stripeCustomerId: null,
    emailVerified: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Password Functions", () => {
    describe("hashPassword", () => {
      it("should hash a password", async () => {
        // Arrange
        const password = "mySecretPassword123!";
        const hashedPassword = "$2b$10$hashedPassword";
        (bcrypt.hash as Mock).mockResolvedValue(hashedPassword);

        // Act
        const result = await hashPassword(password);

        // Assert
        expect(result).toBe(hashedPassword);
        expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      });

      it("should use bcrypt with cost factor 10", async () => {
        // Arrange
        (bcrypt.hash as Mock).mockResolvedValue("$2b$10$hashed");

        // Act
        await hashPassword("password");

        // Assert
        expect(bcrypt.hash).toHaveBeenCalledWith("password", 10);
      });

      it("should handle different password lengths", async () => {
        // Arrange
        const passwords = ["short", "medium_password", "a".repeat(100)];

        for (const password of passwords) {
          vi.clearAllMocks();
          (bcrypt.hash as Mock).mockResolvedValue("$2b$10$hashed");

          // Act
          await hashPassword(password);

          // Assert
          expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
        }
      });
    });

    describe("verifyPassword", () => {
      it("should verify a correct password", async () => {
        // Arrange
        const password = "myPassword123";
        const hash = "$2b$10$hashedPassword";
        (bcrypt.compare as Mock).mockResolvedValue(true);

        // Act
        const result = await verifyPassword(password, hash);

        // Assert
        expect(result).toBe(true);
        expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      });

      it("should reject an incorrect password", async () => {
        // Arrange
        const password = "wrongPassword";
        const hash = "$2b$10$hashedPassword";
        (bcrypt.compare as Mock).mockResolvedValue(false);

        // Act
        const result = await verifyPassword(password, hash);

        // Assert
        expect(result).toBe(false);
        expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      });

      it("should compare password with hash", async () => {
        // Arrange
        (bcrypt.compare as Mock).mockResolvedValue(true);

        // Act
        await verifyPassword("test123", "$2b$10$hash");

        // Assert
        expect(bcrypt.compare).toHaveBeenCalledWith("test123", "$2b$10$hash");
      });
    });
  });

  describe("Access Token Functions", () => {
    describe("generateAccessToken", () => {
      it("should generate an access token with correct payload", () => {
        // Arrange
        const payload: JWTPayload = {
          userId: "user-123",
          email: "test@example.com",
          role: UserRole.author,
        };
        const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
        (jwt.sign as Mock).mockReturnValue(mockToken);

        // Act
        const result = generateAccessToken(payload);

        // Assert
        expect(result).toBe(mockToken);
        expect(jwt.sign).toHaveBeenCalledWith(payload, expect.any(String), {
          expiresIn: "15m",
        });
      });

      it("should use 15 minutes expiry", () => {
        // Arrange
        const payload: JWTPayload = {
          userId: "user-123",
          email: "test@example.com",
          role: UserRole.author,
        };
        (jwt.sign as Mock).mockReturnValue("token");

        // Act
        generateAccessToken(payload);

        // Assert
        const callArgs = (jwt.sign as Mock).mock.calls[0];
        expect(callArgs[2]).toEqual({ expiresIn: "15m" });
      });

      it("should include all payload fields", () => {
        // Arrange
        const payload: JWTPayload = {
          userId: "user-456",
          email: "admin@example.com",
          role: UserRole.admin,
        };
        (jwt.sign as Mock).mockReturnValue("token");

        // Act
        generateAccessToken(payload);

        // Assert
        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "user-456",
            email: "admin@example.com",
            role: UserRole.admin,
          }),
          expect.any(String),
          expect.any(Object),
        );
      });
    });

    describe("verifyAccessToken", () => {
      it("should verify a valid access token", () => {
        // Arrange
        const token = "valid_token";
        const payload: JWTPayload = {
          userId: "user-123",
          email: "test@example.com",
          role: UserRole.author,
        };
        (jwt.verify as Mock).mockReturnValue(payload);

        // Act
        const result = verifyAccessToken(token);

        // Assert
        expect(result).toEqual(payload);
        expect(jwt.verify).toHaveBeenCalledWith(token, expect.any(String));
      });

      it("should return null for invalid token", () => {
        // Arrange
        const token = "invalid_token";
        (jwt.verify as Mock).mockImplementation(() => {
          throw new Error("Invalid token");
        });

        // Act
        const result = verifyAccessToken(token);

        // Assert
        expect(result).toBeNull();
      });

      it("should return null for expired token", () => {
        // Arrange
        const token = "expired_token";
        (jwt.verify as Mock).mockImplementation(() => {
          throw new Error("Token expired");
        });

        // Act
        const result = verifyAccessToken(token);

        // Assert
        expect(result).toBeNull();
      });

      it("should handle jwt verification errors gracefully", () => {
        // Arrange
        (jwt.verify as Mock).mockImplementation(() => {
          throw new Error("JsonWebTokenError");
        });

        // Act
        const result = verifyAccessToken("bad_token");

        // Assert
        expect(result).toBeNull();
      });
    });
  });

  describe("Refresh Token Functions", () => {
    describe("generateRefreshToken", () => {
      it("should generate and store a refresh token", async () => {
        // Arrange
        const userId = "user-123";
        const mockToken = "refresh_token";

        (prisma.refreshToken.create as Mock).mockResolvedValue({
          id: "token-id",
          token: mockToken,
          userId,
          expiresAt: expect.any(Date),
          createdAt: new Date(),
        });

        // Act
        const result = await generateRefreshToken(userId);

        // Assert
        expect(result).toBe(mockToken);
        expect(prisma.refreshToken.create).toHaveBeenCalledWith({
          data: {
            token: mockToken,
            userId,
            expiresAt: expect.any(Date),
          },
        });
      });

      it("should set expiry to 7 days from now", async () => {
        // Arrange
        const userId = "user-123";
        const nowBefore = new Date();

        (prisma.refreshToken.create as Mock).mockResolvedValue({
          id: "token-id",
          token: "token",
          userId,
          expiresAt: new Date(),
          createdAt: new Date(),
        });

        // Act
        await generateRefreshToken(userId);

        // Assert
        const createCall = (prisma.refreshToken.create as Mock).mock
          .calls[0][0];
        const expiresAt = createCall.data.expiresAt;

        const nowAfter = new Date();
        const expectedExpiry = new Date(nowAfter);
        expectedExpiry.setDate(expectedExpiry.getDate() + 7);

        // Allow 1 second difference for test execution time
        const diff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
        expect(diff).toBeLessThan(1000);
      });

      it("should associate token with correct user", async () => {
        // Arrange
        const userId = "specific-user-789";
        (prisma.refreshToken.create as Mock).mockResolvedValue({
          id: "token-id",
          token: "token",
          userId,
          expiresAt: new Date(),
          createdAt: new Date(),
        });

        // Act
        await generateRefreshToken(userId);

        // Assert
        expect(prisma.refreshToken.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: "specific-user-789",
            }),
          }),
        );
      });
    });

    describe("verifyRefreshToken", () => {
      it("should verify a valid refresh token", async () => {
        // Arrange
        const token = "valid_refresh_token";
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        (prisma.refreshToken.findUnique as Mock).mockResolvedValue({
          id: "token-id",
          token,
          userId: mockUser.id,
          expiresAt: futureDate,
          createdAt: new Date(),
          user: mockUser,
        });

        // Act
        const result = await verifyRefreshToken(token);

        // Assert
        expect(result).toEqual(mockUser);
        expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
          where: { token },
          include: { user: true },
        });
      });

      it("should return null for non-existent token", async () => {
        // Arrange
        const token = "non_existent_token";
        (prisma.refreshToken.findUnique as Mock).mockResolvedValue(null);

        // Act
        const result = await verifyRefreshToken(token);

        // Assert
        expect(result).toBeNull();
      });

      it("should return null for expired token", async () => {
        // Arrange
        const token = "expired_token";
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        (prisma.refreshToken.findUnique as Mock).mockResolvedValue({
          id: "token-id",
          token,
          userId: mockUser.id,
          expiresAt: pastDate,
          createdAt: new Date(),
          user: mockUser,
        });

        // Act
        const result = await verifyRefreshToken(token);

        // Assert
        expect(result).toBeNull();
      });

      it("should include user data when token is valid", async () => {
        // Arrange
        const token = "valid_token";
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        (prisma.refreshToken.findUnique as Mock).mockResolvedValue({
          id: "token-id",
          token,
          userId: mockUser.id,
          expiresAt: futureDate,
          createdAt: new Date(),
          user: mockUser,
        });

        // Act
        const result = await verifyRefreshToken(token);

        // Assert
        expect(result).toEqual(mockUser);
        expect(result?.email).toBe(mockUser.email);
      });
    });

    describe("revokeRefreshToken", () => {
      it("should delete a refresh token", async () => {
        // Arrange
        const token = "token_to_revoke";
        (prisma.refreshToken.delete as Mock).mockResolvedValue({
          id: "token-id",
          token,
          userId: "user-123",
          expiresAt: new Date(),
          createdAt: new Date(),
        });

        // Act
        await revokeRefreshToken(token);

        // Assert
        expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
          where: { token },
        });
      });

      it("should not throw error if token does not exist", async () => {
        // Arrange
        const token = "non_existent_token";
        (prisma.refreshToken.delete as Mock).mockRejectedValue(
          new Error("Token not found"),
        );

        // Act & Assert
        await expect(revokeRefreshToken(token)).resolves.not.toThrow();
      });

      it("should handle deletion errors gracefully", async () => {
        // Arrange
        const token = "token";
        (prisma.refreshToken.delete as Mock).mockRejectedValue(
          new Error("Database error"),
        );

        // Act
        await revokeRefreshToken(token);

        // Assert - Should not throw
        expect(prisma.refreshToken.delete).toHaveBeenCalled();
      });
    });

    describe("cleanExpiredTokens", () => {
      it("should delete all expired tokens", async () => {
        // Arrange
        (prisma.refreshToken.deleteMany as Mock).mockResolvedValue({
          count: 5,
        });

        // Act
        await cleanExpiredTokens();

        // Assert
        expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
          where: {
            expiresAt: {
              lt: expect.any(Date),
            },
          },
        });
      });

      it("should use current date for comparison", async () => {
        // Arrange
        const nowBefore = new Date();
        (prisma.refreshToken.deleteMany as Mock).mockResolvedValue({
          count: 0,
        });

        // Act
        await cleanExpiredTokens();

        // Assert
        const callArgs = (prisma.refreshToken.deleteMany as Mock).mock
          .calls[0][0];
        const ltDate = callArgs.where.expiresAt.lt;
        const nowAfter = new Date();

        expect(ltDate.getTime()).toBeGreaterThanOrEqual(nowBefore.getTime());
        expect(ltDate.getTime()).toBeLessThanOrEqual(nowAfter.getTime());
      });
    });

    describe("generateAuthTokens", () => {
      it("should generate both access and refresh tokens", async () => {
        // Arrange
        const mockAccessToken = "access_token_123";
        const mockRefreshToken = "refresh_token";

        (jwt.sign as Mock).mockReturnValue(mockAccessToken);
        (prisma.refreshToken.create as Mock).mockResolvedValue({
          id: "token-id",
          token: mockRefreshToken,
          userId: mockUser.id,
          expiresAt: new Date(),
          createdAt: new Date(),
        });

        // Act
        const result = await generateAuthTokens(mockUser);

        // Assert
        expect(result).toEqual({
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
        });
      });

      it("should create access token with user data", async () => {
        // Arrange
        (jwt.sign as Mock).mockReturnValue("token");
        (prisma.refreshToken.create as Mock).mockResolvedValue({
          id: "token-id",
          token: "refresh_token",
          userId: mockUser.id,
          expiresAt: new Date(),
          createdAt: new Date(),
        });

        // Act
        await generateAuthTokens(mockUser);

        // Assert
        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUser.id,
            email: mockUser.email,
            role: mockUser.role,
          }),
          expect.any(String),
          expect.any(Object),
        );
      });

      it("should create refresh token for user", async () => {
        // Arrange
        (jwt.sign as Mock).mockReturnValue("access_token");
        (prisma.refreshToken.create as Mock).mockResolvedValue({
          id: "token-id",
          token: "refresh_token",
          userId: mockUser.id,
          expiresAt: new Date(),
          createdAt: new Date(),
        });

        // Act
        await generateAuthTokens(mockUser);

        // Assert
        expect(prisma.refreshToken.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: mockUser.id,
            }),
          }),
        );
      });
    });
  });

  describe("Permission Functions", () => {
    describe("getUserPermissions", () => {
      it("should return admin permissions", () => {
        // Act
        const permissions = getUserPermissions(UserRole.admin);

        // Assert
        expect(permissions).toEqual(["*"]);
      });

      it("should return editor permissions", () => {
        // Act
        const permissions = getUserPermissions(UserRole.editor);

        // Assert
        expect(permissions).toEqual([
          "content:*",
          "media:*",
          "comments:moderate",
        ]);
      });

      it("should return author permissions", () => {
        // Act
        const permissions = getUserPermissions(UserRole.author);

        // Assert
        expect(permissions).toEqual([
          "content:create",
          "content:edit:own",
          "media:upload",
        ]);
      });

      it("should return viewer permissions", () => {
        // Act
        const permissions = getUserPermissions(UserRole.viewer);

        // Assert
        expect(permissions).toEqual(["content:read", "comments:create"]);
      });

      it("should handle all user roles", () => {
        // Arrange
        const roles: UserRole[] = ["admin", "editor", "author", "viewer"];

        // Act & Assert
        for (const role of roles) {
          const permissions = getUserPermissions(role);
          expect(permissions).toBeDefined();
          expect(Array.isArray(permissions)).toBe(true);
          expect(permissions.length).toBeGreaterThan(0);
        }
      });
    });

    describe("hasPermission", () => {
      it("should grant all permissions to admin", () => {
        // Act & Assert
        expect(hasPermission(UserRole.admin, "content:create")).toBe(true);
        expect(hasPermission(UserRole.admin, "media:delete")).toBe(true);
        expect(hasPermission(UserRole.admin, "anything:*")).toBe(true);
      });

      it("should grant wildcard permissions to editor", () => {
        // Act & Assert
        expect(hasPermission(UserRole.editor, "content:create")).toBe(true);
        expect(hasPermission(UserRole.editor, "content:delete")).toBe(true);
        expect(hasPermission(UserRole.editor, "media:upload")).toBe(true);
        expect(hasPermission(UserRole.editor, "comments:moderate")).toBe(true);
      });

      it("should restrict author to specific permissions", () => {
        // Act & Assert
        expect(hasPermission(UserRole.author, "content:create")).toBe(true);
        expect(hasPermission(UserRole.author, "media:upload")).toBe(true);
        expect(hasPermission(UserRole.author, "content:delete")).toBe(false);
        expect(hasPermission(UserRole.author, "comments:moderate")).toBe(false);
      });

      it("should restrict viewer to read-only permissions", () => {
        // Act & Assert
        expect(hasPermission(UserRole.viewer, "content:read")).toBe(true);
        expect(hasPermission(UserRole.viewer, "comments:create")).toBe(true);
        expect(hasPermission(UserRole.viewer, "content:create")).toBe(false);
        expect(hasPermission(UserRole.viewer, "media:upload")).toBe(false);
      });

      it("should handle wildcard permissions correctly", () => {
        // Act & Assert
        expect(hasPermission(UserRole.editor, "content:anything")).toBe(true);
        expect(hasPermission(UserRole.editor, "media:whatever")).toBe(true);
        expect(hasPermission(UserRole.editor, "users:create")).toBe(false);
      });

      it("should match exact permissions", () => {
        // Act & Assert
        expect(hasPermission(UserRole.author, "content:edit:own")).toBe(true);
        expect(hasPermission(UserRole.author, "content:edit:all")).toBe(false);
      });
    });
  });

  describe("Header and Authentication Functions", () => {
    describe("extractTokenFromHeader", () => {
      it("should extract token from Bearer header", () => {
        // Arrange
        const authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

        // Act
        const result = extractTokenFromHeader(authHeader);

        // Assert
        expect(result).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test");
      });

      it("should return null for null header", () => {
        // Act
        const result = extractTokenFromHeader(null);

        // Assert
        expect(result).toBeNull();
      });

      it("should return null for non-Bearer header", () => {
        // Arrange
        const authHeader = "Basic dXNlcjpwYXNz";

        // Act
        const result = extractTokenFromHeader(authHeader);

        // Assert
        expect(result).toBeNull();
      });

      it("should return null for malformed Bearer header", () => {
        // Arrange
        const authHeader = "Bearer";

        // Act
        const result = extractTokenFromHeader(authHeader);

        // Assert
        expect(result).toBe(null);
      });

      it("should handle Bearer header with extra spaces", () => {
        // Arrange
        const authHeader = "Bearer  token_with_space";

        // Act
        const result = extractTokenFromHeader(authHeader);

        // Assert
        expect(result).toBe(" token_with_space");
      });
    });

    describe("authenticateRequest", () => {
      it("should authenticate valid request with token", () => {
        // Arrange
        const authHeader = "Bearer valid_token";
        const payload: JWTPayload = {
          userId: "user-123",
          email: "test@example.com",
          role: UserRole.author,
        };
        (jwt.verify as Mock).mockReturnValue(payload);

        // Act
        const result = authenticateRequest(authHeader);

        // Assert
        expect(result).toEqual(payload);
        expect(jwt.verify).toHaveBeenCalledWith(
          "valid_token",
          expect.any(String),
        );
      });

      it("should return null for missing header", () => {
        // Act
        const result = authenticateRequest(null);

        // Assert
        expect(result).toBeNull();
      });

      it("should return null for invalid Bearer header", () => {
        // Arrange
        const authHeader = "Basic dXNlcjpwYXNz";

        // Act
        const result = authenticateRequest(authHeader);

        // Assert
        expect(result).toBeNull();
      });

      it("should return null for invalid token", () => {
        // Arrange
        const authHeader = "Bearer invalid_token";
        (jwt.verify as Mock).mockImplementation(() => {
          throw new Error("Invalid token");
        });

        // Act
        const result = authenticateRequest(authHeader);

        // Assert
        expect(result).toBeNull();
      });

      it("should extract and verify token correctly", () => {
        // Arrange
        const authHeader = "Bearer my_jwt_token";
        const payload: JWTPayload = {
          userId: "user-456",
          email: "admin@example.com",
          role: UserRole.admin,
        };
        (jwt.verify as Mock).mockReturnValue(payload);

        // Act
        const result = authenticateRequest(authHeader);

        // Assert
        expect(result).toEqual(payload);
        expect(jwt.verify).toHaveBeenCalledWith(
          "my_jwt_token",
          expect.any(String),
        );
      });
    });
  });

  describe("Resource Modification", () => {
    describe("canModifyResource", () => {
      it("should allow admin to modify any resource", () => {
        // Act & Assert
        expect(canModifyResource(UserRole.admin, "user-123", "user-456")).toBe(
          true,
        );
        expect(canModifyResource(UserRole.admin, "user-123", "user-789")).toBe(
          true,
        );
      });

      it("should allow editor to modify any resource", () => {
        // Act & Assert
        expect(canModifyResource(UserRole.editor, "user-123", "user-456")).toBe(
          true,
        );
        expect(canModifyResource(UserRole.editor, "user-123", "user-789")).toBe(
          true,
        );
      });

      it("should allow author to modify own resources only", () => {
        // Act & Assert
        expect(canModifyResource(UserRole.author, "user-123", "user-123")).toBe(
          true,
        );
        expect(canModifyResource(UserRole.author, "user-123", "user-456")).toBe(
          false,
        );
      });

      it("should allow viewer to modify own resources only", () => {
        // Act & Assert
        expect(canModifyResource(UserRole.viewer, "user-123", "user-123")).toBe(
          true,
        );
        expect(canModifyResource(UserRole.viewer, "user-123", "user-456")).toBe(
          false,
        );
      });

      it("should handle same user ID correctly", () => {
        // Arrange
        const userId = "user-same-123";

        // Act & Assert
        expect(canModifyResource(UserRole.author, userId, userId)).toBe(true);
        expect(canModifyResource(UserRole.viewer, userId, userId)).toBe(true);
      });

      it("should handle different user IDs correctly", () => {
        // Act & Assert
        expect(canModifyResource(UserRole.author, "user-1", "user-2")).toBe(
          false,
        );
        expect(canModifyResource(UserRole.viewer, "user-1", "user-2")).toBe(
          false,
        );
      });
    });
  });

  describe("Integration Tests", () => {
    it("should complete full auth flow", async () => {
      // Arrange
      const password = "myPassword123";
      const hashedPassword = "$2b$10$hashed";
      const accessToken = "access_token";
      const refreshToken = "refresh_token";

      (bcrypt.hash as Mock).mockResolvedValue(hashedPassword);
      (jwt.sign as Mock).mockReturnValue(accessToken);
      (prisma.refreshToken.create as Mock).mockResolvedValue({
        id: "token-id",
        token: refreshToken,
        userId: mockUser.id,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      // Act - Hash password
      const hashed = await hashPassword(password);
      expect(hashed).toBe(hashedPassword);

      // Act - Generate tokens
      const tokens = await generateAuthTokens(mockUser);
      expect(tokens.accessToken).toBe(accessToken);
      expect(tokens.refreshToken).toBe(refreshToken);

      // Act - Verify password
      (bcrypt.compare as Mock).mockResolvedValue(true);
      const isValid = await verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it("should handle token refresh flow", async () => {
      // Arrange
      const oldRefreshToken = "old_refresh_token";
      const newAccessToken = "new_access_token";
      const newRefreshToken = "refresh_token";
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      // Act - Verify old refresh token
      (prisma.refreshToken.findUnique as Mock).mockResolvedValue({
        id: "token-id",
        token: oldRefreshToken,
        userId: mockUser.id,
        expiresAt: futureDate,
        createdAt: new Date(),
        user: mockUser,
      });

      const user = await verifyRefreshToken(oldRefreshToken);
      expect(user).toEqual(mockUser);

      // Act - Revoke old token
      (prisma.refreshToken.delete as Mock).mockResolvedValue({
        id: "token-id",
        token: oldRefreshToken,
        userId: mockUser.id,
        expiresAt: futureDate,
        createdAt: new Date(),
      });

      await revokeRefreshToken(oldRefreshToken);
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { token: oldRefreshToken },
      });

      // Act - Generate new tokens
      (jwt.sign as Mock).mockReturnValue(newAccessToken);
      (prisma.refreshToken.create as Mock).mockResolvedValue({
        id: "new-token-id",
        token: newRefreshToken,
        userId: mockUser.id,
        expiresAt: futureDate,
        createdAt: new Date(),
      });

      const newTokens = await generateAuthTokens(user!);
      expect(newTokens.accessToken).toBe(newAccessToken);
      expect(newTokens.refreshToken).toBe(newRefreshToken);
    });

    it("should handle authentication and authorization flow", () => {
      // Arrange
      const authHeader = "Bearer valid_access_token";
      const payload: JWTPayload = {
        userId: "user-123",
        email: "author@example.com",
        role: UserRole.author,
      };
      (jwt.verify as Mock).mockReturnValue(payload);

      // Act - Authenticate
      const authResult = authenticateRequest(authHeader);
      expect(authResult).toEqual(payload);

      // Act - Check permissions
      const canCreate = hasPermission(authResult!.role, "content:create");
      const canModerate = hasPermission(authResult!.role, "comments:moderate");

      // Assert
      expect(canCreate).toBe(true); // Author can create
      expect(canModerate).toBe(false); // Author cannot moderate

      // Act - Check resource modification
      const canModifyOwn = canModifyResource(
        authResult!.role,
        authResult!.userId,
        "user-123",
      );
      const canModifyOthers = canModifyResource(
        authResult!.role,
        authResult!.userId,
        "user-456",
      );

      // Assert
      expect(canModifyOwn).toBe(true);
      expect(canModifyOthers).toBe(false);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty password", async () => {
      // Arrange
      (bcrypt.hash as Mock).mockResolvedValue("$2b$10$hashed");

      // Act
      await hashPassword("");

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith("", 10);
    });

    it("should handle very long passwords", async () => {
      // Arrange
      const longPassword = "a".repeat(1000);
      (bcrypt.hash as Mock).mockResolvedValue("$2b$10$hashed");

      // Act
      await hashPassword(longPassword);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(longPassword, 10);
    });

    it("should handle special characters in tokens", () => {
      // Arrange
      const specialToken = "token!@#$%^&*()";
      const authHeader = `Bearer ${specialToken}`;

      // Act
      const result = extractTokenFromHeader(authHeader);

      // Assert
      expect(result).toBe(specialToken);
    });

    it("should handle undefined in permission check", () => {
      // Act & Assert
      expect(hasPermission(UserRole.author, "")).toBe(false);
    });
  });
});
