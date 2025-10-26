// /pages/api/logout.ts
import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  // Delete cookies
  cookies.delete("accessToken", { path: "/" });
  cookies.delete("refreshToken", { path: "/" });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
};
