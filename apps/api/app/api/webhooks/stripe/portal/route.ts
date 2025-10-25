// app/api/stripe/portal/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createPortalSession } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const user = authenticateRequest(authHeader);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { returnUrl } = await request.json();

    if (!returnUrl) {
      return NextResponse.json({ error: "Missing returnUrl" }, { status: 400 });
    }

    const session = await createPortalSession(user.userId, returnUrl);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Create portal error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 },
    );
  }
}
