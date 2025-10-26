// apps/api/app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  verifyRefreshToken,
  generateAuthTokens,
  revokeRefreshToken,
  getUserPermissions,
} from "@/lib/auth";
import { validateRequest, refreshTokenSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = await validateRequest(refreshTokenSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 },
      );
    }

    const { refreshToken } = validation.data;

    // Verify refresh token
    const user = await verifyRefreshToken(refreshToken);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired refresh token" },
        { status: 401 },
      );
    }

    // Revoke old refresh token
    await revokeRefreshToken(refreshToken);

    // Generate new tokens
    const tokens = await generateAuthTokens(user);

    // Return new tokens
    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred while refreshing token" },
      { status: 500 },
    );
  }
}
