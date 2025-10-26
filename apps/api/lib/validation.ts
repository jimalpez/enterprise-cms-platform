// @lib/validation.ts
import { z } from "zod";
import { Prisma } from "@prisma/client";

interface defaultProps {
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
  fit?: string;
}

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain uppercase, lowercase, and number",
    ),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const metadataSchema = z
  .record(
    z.string(),
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
    ]),
  )
  .transform((val) => val as Prisma.InputJsonValue);

// Content schemas
export const createContentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().optional(),
  type: z.enum(["article", "page", "media"]).default("article"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  featuredImage: z.string().url().optional().or(z.literal("")),
  tags: z.array(z.string()).default([]),
  metadata: metadataSchema.default({}),
});

export const updateContentSchema = createContentSchema.partial();

export const publishContentSchema = z.object({
  publishedAt: z.string().datetime().optional(),
});

// Validation error handler
export function formatZodError(error: z.ZodError) {
  const formatted = error.format();
  const errors: Array<{ field: string; message: string }> = [];

  // Handle nested errors in the formatted object
  const processErrors = (obj: any, path: string = "") => {
    if (obj && typeof obj === "object") {
      if (obj._errors && obj._errors.length > 0) {
        errors.push({
          field: path || "root",
          message: obj._errors[0] || "Validation error",
        });
      }

      // Process nested fields
      Object.entries(obj).forEach(([key, value]) => {
        if (key !== "_errors") {
          const newPath = path ? `${path}.${key}` : key;
          processErrors(value, newPath);
        }
      });
    }
  };

  processErrors(formatted);
  return errors.length > 0
    ? errors
    : [{ field: "unknown", message: "Validation error" }];
}

// Validate request body
export async function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): Promise<{ success: true; data: T } | { success: false; errors: any[] }> {
  try {
    const validData = await schema.parseAsync(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = formatZodError(error);
      return { success: false, errors };
    }
    return { success: false, errors: [{ message: "Validation failed" }] };
  }
}

// Comment schemas - UPDATE/EXPAND EXISTING
export const createCommentSchema = z.object({
  contentId: z.string().min(1, "Content ID is required"),
  text: z
    .string()
    .min(1, "Comment text is required")
    .max(5000, "Comment must be less than 5000 characters"),
  parentId: z.string().optional().nullable(),
});

export const updateCommentSchema = z.object({
  text: z
    .string()
    .min(1, "Comment text is required")
    .max(5000, "Comment must be less than 5000 characters"),
});

export const getCommentsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(["createdAt", "likes"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Media optimization validation schema
 */
export const optimizeMediaSchema = z
  .object({
    mediaId: z.string().cuid().optional(),
    url: z.string().url().optional(),
    options: z
      .object({
        width: z.number().int().positive().max(4096).optional(),
        height: z.number().int().positive().max(4096).optional(),
        quality: z.number().int().min(1).max(100).optional().default(85),
        format: z
          .enum(["jpeg", "png", "webp", "avif"])
          .optional()
          .default("webp"),
        fit: z
          .enum(["cover", "contain", "fill", "inside", "outside"])
          .optional()
          .default("inside"),
      })
      .optional()
      .default({
        width: 80,
        height: 80,
        quality: 85,
        format: "webp",
        fit: "inside",
      }),
    createVariants: z.boolean().optional().default(false),
  })
  .refine((data) => data.mediaId || data.url, {
    message: "Either mediaId or url must be provided",
    path: ["mediaId", "url"],
  });

/**
 * Media query validation schema (for listing/filtering media)
 */
export const mediaQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  mimetype: z.string().optional(),
  uploadedBy: z.string().cuid().optional(),
  sortBy: z
    .enum(["createdAt", "size", "filename"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * Media deletion validation schema
 */
export const deleteMediaSchema = z.object({
  id: z.string().cuid(),
  deleteFile: z.boolean().optional().default(true), // Also delete file from disk
});

/**
 * Bulk media operations
 */
export const bulkMediaSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, "At least one media ID is required"),
  action: z.enum(["delete", "archive"]),
});

/**
 * File type validators
 */
export const isImage = (mimetype: string): boolean => {
  return mimetype.startsWith("image/");
};

export const isVideo = (mimetype: string): boolean => {
  return mimetype.startsWith("video/");
};

export const isDocument = (mimetype: string): boolean => {
  return [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ].includes(mimetype);
};

/**
 * Utility functions for media
 */
export const formatFileSize = (bytes: number): string => {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
};

export function getFileExtension(filename: string): string {
  // Check if filename contains a dot
  if (!filename.includes(".")) {
    return "";
  }

  const parts = filename.split(".");

  // If only one part (filename with leading dot like ".gitignore")
  if (parts.length === 1) {
    return "";
  }

  // Return the last part (extension) in lowercase
  return parts[parts.length - 1].toLowerCase();
}

export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-z0-9.-]/gi, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase();
};

/**
 * Validate file before upload (client-side helper)
 */
export const validateFileUpload = (
  file: File,
  maxSize: number = 10 * 1024 * 1024,
  allowedTypes: string[] = [],
): { valid: boolean; error?: string } => {
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${formatFileSize(maxSize)} limit`,
    };
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type",
    };
  }

  return { valid: true };
};

/**
 * Enhanced search schema with flexible date filtering and sorting
 */
export const searchSchema = z.object({
  // Text search query
  q: z.string().optional(),

  // Content type filter
  type: z.enum(["article", "page", "media"]).optional(),

  // Author filter (supports name, email, or ID)
  author: z.string().optional(),

  // Status filter
  status: z.enum(["draft", "published", "archived"]).optional(),

  // Tags filter (array of strings)
  tags: z.array(z.string()).optional(),

  // Simple date filter (year or full date)
  date: z.string().optional(),

  // Date range filters
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),

  // Pagination
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),

  // Sorting
  sortBy: z
    .enum(["createdAt", "updatedAt", "publishedAt", "title"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Search result type
export type SearchFilters = z.infer<typeof searchSchema>;
