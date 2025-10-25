// app/api/stripe/create-checkout/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const user = authenticateRequest(authHeader);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { priceId, successUrl, cancelUrl } = await request.json();

    if (!priceId || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const session = await createCheckoutSession(
      user.userId,
      priceId,
      successUrl,
      cancelUrl,
    );

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Create checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
