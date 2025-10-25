// @lib/auth.ts

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { prisma } from "./prisma";
import type { User, UserRole } from "@prisma/client";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  "your-super-secret-refresh-key-change-in-production";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Verify password
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate access token
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

// Generate refresh token
export async function generateRefreshToken(userId: string): Promise<string> {
  const token = nanoid(64);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
}

// Generate both tokens
export async function generateAuthTokens(user: User): Promise<AuthTokens> {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(user.id);

  return { accessToken, refreshToken };
}

// Verify access token
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// Verify refresh token
export async function verifyRefreshToken(token: string): Promise<User | null> {
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!refreshToken || refreshToken.expiresAt < new Date()) {
    return null;
  }

  return refreshToken.user;
}

// Revoke refresh token
export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken
    .delete({
      where: { token },
    })
    .catch(() => {
      // Token might not exist, ignore error
    });
}

// Clean expired refresh tokens
export async function cleanExpiredTokens(): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
}

// Get user permissions
export function getUserPermissions(role: UserRole): string[] {
  const permissions: Record<UserRole, string[]> = {
    admin: ["*"],
    editor: ["content:*", "media:*", "comments:moderate"],
    author: ["content:create", "content:edit:own", "media:upload"],
    viewer: ["content:read", "comments:create"],
  };

  return permissions[role];
}

// Check permission
export function hasPermission(userRole: UserRole, permission: string): boolean {
  const permissions = getUserPermissions(userRole);

  if (permissions.includes("*")) {
    return true;
  }

  return permissions.some((p) => {
    if (p.endsWith(":*")) {
      const prefix = p.slice(0, -2);
      return permission.startsWith(prefix);
    }
    return p === permission;
  });
}

// Extract token from request header
export function extractTokenFromHeader(
  authHeader: string | null,
): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

export function authenticateRequest(
  authHeader: string | null,
): JWTPayload | null {
  const token = extractTokenFromHeader(authHeader);
  if (!token) {
    return null;
  }
  return verifyAccessToken(token);
}

/**
 * Check if user can modify a resource (own resource or admin/editor)
 */
export function canModifyResource(
  userRole: UserRole,
  userId: string,
  resourceOwnerId: string,
): boolean {
  // Admins and editors can modify anything
  if (userRole === "admin" || userRole === "editor") {
    return true;
  }
  // Users can only modify their own resources
  return userId === resourceOwnerId;
}
