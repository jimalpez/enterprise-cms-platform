// apps/web/src/hooks/useContent.ts
import { useState, useCallback } from "react";
import { contentApi } from "@/lib/api";

// Types matching Prisma schema
export type ContentType = "article" | "page" | "media";
export type ContentStatus = "draft" | "published" | "archived";
export type UserRole = "admin" | "editor" | "author" | "viewer";

export interface ContentData {
  id?: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  type: ContentType;
  status: ContentStatus;
  authorId: string;
  featuredImage?: string;
  tags: string[];
  metadata: Record<string, any>;
  version: number;
  publishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ContentVersion {
  id: string;
  contentId: string;
  version: number;
  data: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  publishedAt?: Date;
}

export interface SaveContentResponse {
  success: boolean;
  content?: ContentData;
  version?: number;
  error?: string;
}

/**
 * Hook for managing content CRUD operations
 * Uses the existing lib/api.ts client with JWT authentication
 */
export function useContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveContent = useCallback(
    async (content: ContentData): Promise<SaveContentResponse> => {
      setLoading(true);
      setError(null);

      try {
        let savedContent;

        if (content.id) {
          // Update existing content
          savedContent = await contentApi.update(content.id, content);
        } else {
          // Create new content
          savedContent = await contentApi.create(content);
        }

        // savedContent is already the unwrapped Content object
        return {
          success: true,
          content: savedContent,
          version: savedContent.version,
        };
      } catch (err: any) {
        const message =
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Failed to save content";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const publishContent = useCallback(
    async (content: ContentData): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        if (!content.id) {
          throw new Error("Cannot publish content without ID");
        }

        await contentApi.publish(content.id);
      } catch (err: any) {
        const message =
          err.response?.data?.message ||
          err.message ||
          "Failed to publish content";
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const createVersion = useCallback(
    async (content: ContentData): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        if (!content.id) {
          throw new Error("Cannot create version without content ID");
        }

        // Call your API to create a new version
        const response = await fetch(`/api/content/${content.id}/version`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
          body: JSON.stringify({
            data: {
              title: content.title,
              content: content.content,
              excerpt: content.excerpt,
              tags: content.tags,
              metadata: content.metadata,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to create version");
        }
      } catch (err: any) {
        const message = err.message || "Failed to create version";
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadContent = useCallback(
    async (contentId: string): Promise<ContentData | null> => {
      setLoading(true);
      setError(null);

      try {
        const content = await contentApi.getById(contentId);
        return content as ContentData;
      } catch (err: any) {
        const message =
          err.response?.data?.message ||
          err.message ||
          "Failed to load content";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadVersionHistory = useCallback(
    async (contentId: string): Promise<ContentVersion[]> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/content/${contentId}/versions`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to load versions");
        }

        const data = await response.json();
        return data.data?.versions || [];
      } catch (err: any) {
        const message = err.message || "Failed to load versions";
        setError(message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const deleteContent = useCallback(
    async (contentId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        console.log("Deleting content with ID:", contentId); // Debug log
        await contentApi.delete(contentId);
        console.log("Delete successful"); // Debug log
        return true;
      } catch (err: any) {
        console.error("Delete content error:", err); // Debug log
        const message =
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Failed to delete content";
        console.error("Error message:", message); // Debug log
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    loading,
    error,
    saveContent,
    publishContent,
    createVersion,
    loadContent,
    loadVersionHistory,
    deleteContent,
  };
}

/**
 * Hook for media upload
 */
export function useMediaUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadMedia = useCallback(
    async (file: File): Promise<{ url: string; id: string } | null> => {
      setUploading(true);
      setError(null);
      setProgress(0);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const token = localStorage.getItem("accessToken");

        const response = await fetch("/api/media/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to upload media");
        }

        const data = await response.json();
        setProgress(100);

        return {
          url: data.data?.url || data.url,
          id: data.data?.id || data.id,
        };
      } catch (err: any) {
        const message = err.message || "Failed to upload media";
        setError(message);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  return {
    uploading,
    progress,
    error,
    uploadMedia,
  };
}

/**
 * Hook for slug availability check
 */
export function useSlugCheck() {
  const [checking, setChecking] = useState(false);

  const checkSlug = useCallback(
    async (slug: string, excludeId?: string): Promise<boolean> => {
      setChecking(true);

      try {
        const token = localStorage.getItem("accessToken");
        const params = new URLSearchParams({ slug });
        if (excludeId) params.append("excludeId", excludeId);

        const response = await fetch(`/api/content/check-slug?${params}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        return data.data?.available || data.available || false;
      } catch (err) {
        console.error("Failed to check slug:", err);
        return false;
      } finally {
        setChecking(false);
      }
    },
    [],
  );

  return { checking, checkSlug };
}
