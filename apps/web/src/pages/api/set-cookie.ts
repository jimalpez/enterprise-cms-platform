import type { APIRoute } from "astro";

// Mark this endpoint as server-rendered
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Check if request has a body
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return new Response(
        JSON.stringify({ error: "Content-Type must be application/json" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const text = await request.text();
    if (!text) {
      return new Response(JSON.stringify({ error: "Request body is empty" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { accessToken, refreshToken } = JSON.parse(text);

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No token provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Set cookies with proper options
    cookies.set("accessToken", accessToken, {
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
      httpOnly: true, // Recommended for security
      secure: import.meta.env.PROD, // true in production
      sameSite: "lax",
    });

    if (refreshToken) {
      cookies.set("refreshToken", refreshToken, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: "lax",
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Set cookie error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to set cookies",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
