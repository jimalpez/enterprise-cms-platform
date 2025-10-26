// apps/api/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  generateAuthTokens,
  getUserPermissions,
} from "@/lib/auth";
import { validateRequest, registerSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/redis";
import { UserRole } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { allowed, remaining } = await checkRateLimit(
      `register:${ip}`,
      5,
      3600,
    );

    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many registration attempts. Please try again later.",
        },
        {
          status: 429,
          headers: { "X-RateLimit-Remaining": remaining.toString() },
        },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = await validateRequest(registerSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 },
      );
    }

    const { email, password, name } = validation.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "User with this email already exists" },
        { status: 409 },
      );
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: UserRole.author,
        emailVerified: null,
      },
    });

    // Generate tokens
    const tokens = await generateAuthTokens(user);

    // Return user data with tokens
    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: getUserPermissions(user.role),
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred during registration" },
      { status: 500 },
    );
  }
}
