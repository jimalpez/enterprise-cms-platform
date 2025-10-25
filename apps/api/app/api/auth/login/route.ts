// apps/api/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  generateAuthTokens,
  getUserPermissions,
} from "@/lib/auth";
import { validateRequest, loginSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { allowed, remaining } = await checkRateLimit(
      `login:${ip}`,
      10,
      3600,
    );

    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many login attempts. Please try again later.",
        },
        {
          status: 429,
          headers: { "X-RateLimit-Remaining": remaining.toString() },
        },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = await validateRequest(loginSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 },
      );
    }

    const { email, password } = validation.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Check if user exists and has a password (OAuth users don't have passwords)
    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Generate tokens
    const tokens = await generateAuthTokens(user);

    // Get permissions
    const permissions = getUserPermissions(user.role);

    // Return user data with tokens
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          stripeCustomerId: user.stripeCustomerId,
          emailVerified: user.emailVerified,
          permissions,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred during login" },
      { status: 500 },
    );
  }
}
