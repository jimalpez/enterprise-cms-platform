import type { AstroCookies } from "astro";

export function checkAuth(cookies: AstroCookies): boolean {
  const token = cookies.get("accessToken");
  return !!token?.value;
}

export function requireAuth(cookies: AstroCookies, url: URL): Response | null {
  if (!checkAuth(cookies)) {
    const currentPath = url.pathname + url.search;
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/login?redirect=${encodeURIComponent(currentPath)}`,
      },
    });
  }
  return null;
}
