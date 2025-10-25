import type { UserRole } from "./types";

// Slug generation
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Permission checking
export function hasPermission(userRole: UserRole, permission: string): boolean {
  const rolePermissions: Record<UserRole, string[]> = {
    admin: ["*"],
    editor: ["content:*", "media:*", "comments:moderate"],
    author: ["content:create", "content:edit:own", "media:upload"],
    viewer: ["content:read", "comments:create"],
  };

  const permissions = rolePermissions[userRole];

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

// Validation helpers
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

// Date formatting
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Excerpt generation
export function generateExcerpt(content: string, length: number = 160): string {
  const plainText = content.replace(/<[^>]+>/g, "");
  if (plainText.length <= length) {
    return plainText;
  }
  return plainText.substring(0, length).trim() + "...";
}

// Pagination helpers
export function calculatePagination(
  total: number,
  page: number,
  limit: number,
) {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };
}
