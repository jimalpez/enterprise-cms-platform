// apps/web/src/components/react/ContentEditor.tsx
"use client";

import { useState, useEffect } from "react";
import RichTextEditor from "./Editor";
import { useContent } from "@/hooks/useContent";
import { authApi } from "@/lib/api";
import type { ContentData } from "@/hooks/useContent";

interface ContentEditorProps {
  contentId?: string;
  mode?: "create" | "edit";
  onSaveSuccess?: (content: ContentData) => void;
  onPublishSuccess?: (content: ContentData) => void;
}

/**
 * ContentEditor wrapper for Astro integration
 * Handles loading content, authentication, and callbacks
 */
export default function ContentEditor({
  contentId,
  mode = "create",
  onSaveSuccess,
  onPublishSuccess,
}: ContentEditorProps) {
  const [initialContent, setInitialContent] = useState<Partial<ContentData>>();
  const [loading, setLoading] = useState(!!contentId);
  const [user, setUser] = useState<any>(null);
  const [authError, setAuthError] = useState(false);

  const {
    saveContent,
    publishContent,
    createVersion,
    loadContent,
    deleteContent,
    error: apiError,
  } = useContent();

  // Check authentication
  useEffect(() => {
    const currentUser = authApi.getUser();
    if (!currentUser) {
      setAuthError(true);
      setLoading(false);
      return;
    }
    setUser(currentUser);
  }, []);

  // Load existing content if editing
  useEffect(() => {
    if (contentId && user) {
      loadContent(contentId).then((content) => {
        if (content) {
          setInitialContent(content);
        }
        setLoading(false);
      });
    } else if (!contentId) {
      setLoading(false);
    }
  }, [contentId, user]);

  const handleSave = async (content: ContentData) => {
    // Ensure ID is included if editing existing content
    const contentToSave = {
      ...content,
      id: contentId || content.id, // Use contentId from props if available
    };

    const result = await saveContent(contentToSave);

    if (result.success && result.content) {
      // Update the initialContent state with saved content (including ID)
      setInitialContent(result.content);

      // If creating new content, navigate to edit mode
      if (!contentId && result.content.id) {
        if (onSaveSuccess) {
          onSaveSuccess(result.content);
        } else {
          window.location.href = `/dashboard/content/${result.content.id}/edit`;
        }
      } else if (onSaveSuccess) {
        onSaveSuccess(result.content);
      }
    }

    return result;
  };

  const handlePublish = async (content: ContentData) => {
    // Ensure ID is included if editing existing content
    const contentToSave = {
      ...content,
      id: contentId || content.id, // Use contentId from props if available
    };

    // First save to ensure we have an ID
    const saveResult = await saveContent(contentToSave);

    if (!saveResult.success || !saveResult.content?.id) {
      throw new Error(
        saveResult.error || "Failed to save content before publishing",
      );
    }

    // Now publish using the saved content with ID
    await publishContent(saveResult.content);

    // Update state with published content
    setInitialContent(saveResult.content);

    if (onPublishSuccess) {
      onPublishSuccess(saveResult.content);
    } else {
      // Navigate to the published content
      window.location.href = `/blog/${saveResult.content.slug}`;
    }
  };

  const handleDelete = async (content: ContentData) => {
    if (!content.id) {
      alert("Cannot delete content without ID");
      return;
    }

    // Confirm deletion
    if (
      !window.confirm(
        "Are you sure you want to delete this content? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const success = await deleteContent(content.id);

      if (success) {
        // Navigate back to content list after successful deletion
        window.location.href = "/dashboard/content";
      } else {
        // Show error from the hook
        alert(apiError || "Failed to delete content. Please try again.");
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      alert(error.message || "Failed to delete content. Please try again.");
    }
  };

  const handleCreateVersion = async (content: ContentData) => {
    await createVersion(content);
  };

  // Authentication error
  if (authError) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h2 className="text-xl font-bold text-yellow-900 mb-2">
          Authentication Required
        </h2>
        <p className="text-yellow-700 mb-4">
          Please log in to access the editor.
        </p>
        <a
          href="/login"
          className="inline-block px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
          Go to Login
        </a>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading content...</p>
        </div>
      </div>
    );
  }

  // API error
  if (apiError) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-bold text-red-900 mb-2">Error</h2>
        <p className="text-red-700 mb-4">{apiError}</p>
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
          Go Back
        </button>
      </div>
    );
  }

  // No user (shouldn't happen due to authError check above)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <RichTextEditor
        initialContent={initialContent}
        userId={user.id}
        onSave={handleSave}
        onPublish={handlePublish}
        onCreateVersion={handleCreateVersion}
        onDelete={handleDelete}
        autoSave={true}
        autoSaveInterval={3000}
      />
    </div>
  );
}
