// @component/react/Editor.tsx
import { useState, useCallback, useEffect, useRef } from "react";
import {
  useEditor,
  EditorContent,
  Editor as TipTapEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { debounce } from "lodash";

// Types matching Prisma schema
type ContentType = "article" | "page" | "media";
type ContentStatus = "draft" | "published" | "archived";

interface ContentData {
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
}

interface EditorProps {
  initialContent?: Partial<ContentData>;
  userId: string;
  onSave: (
    content: ContentData,
  ) => Promise<{ success: boolean; version?: number }>;
  onPublish?: (content: ContentData) => Promise<void>;
  onCreateVersion?: (content: ContentData) => Promise<void>;
  onDelete?: (content: ContentData) => Promise<void>;
  autoSave?: boolean;
  autoSaveInterval?: number;
  collaborativeMode?: boolean;
}

export default function RichTextEditor({
  initialContent,
  userId,
  onSave,
  onPublish,
  onCreateVersion,
  onDelete,
  autoSave = true,
  autoSaveInterval = 3000,
  collaborativeMode = false,
}: EditorProps) {
  // Content state
  const [contentData, setContentData] = useState<ContentData>({
    id: initialContent?.id,
    title: initialContent?.title || "",
    slug: initialContent?.slug || "",
    content: initialContent?.content || "",
    excerpt: initialContent?.excerpt || "",
    type: initialContent?.type || "article",
    status: initialContent?.status || "draft",
    authorId: userId,
    featuredImage: initialContent?.featuredImage || "",
    tags: initialContent?.tags || [],
    metadata: initialContent?.metadata || {},
    version: initialContent?.version || 1,
    publishedAt: initialContent?.publishedAt,
  });

  // Editor state
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showMetadata, setShowMetadata] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "editor-image",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "editor-link",
        },
      }),
      Placeholder.configure({
        placeholder: "Start writing your content...",
      }),
    ],
    content: contentData.content,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[500px] p-4",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setContentData((prev) => ({ ...prev, content: html }));
      setHasUnsavedChanges(true);

      if (autoSave) {
        debouncedSave();
      }
    },
  });

  // Auto-save with debounce
  const debouncedSave = useCallback(
    debounce(async () => {
      if (hasUnsavedChanges) {
        await handleSave();
      }
    }, autoSaveInterval),
    [hasUnsavedChanges, contentData],
  );

  // Save content
  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await onSave(contentData);
      if (result.success) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        if (result.version) {
          setContentData((prev) => ({ ...prev, version: result.version! }));
        }
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  // Publish content
  const handlePublish = async () => {
    if (!onPublish) return;

    const publishedContent = {
      ...contentData,
      status: "published" as ContentStatus,
      publishedAt: new Date(),
    };

    setSaving(true);
    try {
      await onPublish(publishedContent);
      setContentData(publishedContent);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
    } catch (error) {
      console.error("Failed to publish:", error);
    } finally {
      setSaving(false);
    }
  };

  // Create new version
  const handleCreateVersion = async () => {
    if (!onCreateVersion) return;

    setSaving(true);
    try {
      await onCreateVersion(contentData);
      setContentData((prev) => ({ ...prev, version: prev.version + 1 }));
      setLastSaved(new Date());
    } catch (error) {
      console.error("Failed to create version:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !initialContent?.id) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this content? This action cannot be undone.",
    );

    if (!confirmDelete) return;

    setSaving(true);
    try {
      await onDelete(contentData);
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Failed to delete content. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Generate slug from title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/--+/g, "-")
      .trim();
  };

  // Update title and auto-generate slug if needed
  const handleTitleChange = (title: string) => {
    setContentData((prev) => {
      const newSlug =
        !prev.slug || prev.slug === generateSlug(prev.title)
          ? generateSlug(title)
          : prev.slug;

      return { ...prev, title, slug: newSlug };
    });
    setHasUnsavedChanges(true);
  };

  // Add tag
  const handleAddTag = () => {
    if (tagInput.trim() && !contentData.tags.includes(tagInput.trim())) {
      setContentData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput("");
      setHasUnsavedChanges(true);
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setContentData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
    setHasUnsavedChanges(true);
  };

  // Generate excerpt from content
  const generateExcerpt = () => {
    if (!editor) return;

    const text = editor.getText();
    const excerpt =
      text.slice(0, 160).trim() + (text.length > 160 ? "..." : "");
    setContentData((prev) => ({ ...prev, excerpt }));
    setHasUnsavedChanges(true);
  };

  // Insert image
  const insertImage = () => {
    const url = window.prompt("Enter image URL:");
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      debouncedSave.cancel();
    };
  }, []);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="editor-wrapper max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="editor-header mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span> Saving...
              </span>
            ) : hasUnsavedChanges ? (
              <span className="text-amber-600">● Unsaved changes</span>
            ) : lastSaved ? (
              <span className="text-green-600">
                ✓ Saved {lastSaved.toLocaleTimeString()}
              </span>
            ) : null}
          </span>
          <span className="text-xs text-gray-500">
            Version {contentData.version}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            Save Draft
          </button>

          {onCreateVersion && (
            <button
              onClick={handleCreateVersion}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
              Create Version
            </button>
          )}

          {onPublish && (
            <button
              onClick={handlePublish}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
              {contentData.status === "published"
                ? "Update Published"
                : "Publish"}
            </button>
          )}

          {onDelete && initialContent?.id && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
              Delete
            </button>
          )}
        </div>

        {/* Status indicator */}
        <div className="text-sm text-gray-600">
          {hasUnsavedChanges && !saving && (
            <span className="text-orange-600">● Unsaved changes</span>
          )}
          {saving && <span className="text-blue-600">● Saving...</span>}
          {!hasUnsavedChanges && !saving && lastSaved && (
            <span className="text-green-600">
              ✓ Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Content Metadata */}
      <div className="content-metadata mb-6 space-y-4 bg-gray-50 p-4 rounded-lg">
        {/* Title */}
        <div>
          <input
            type="text"
            value={contentData.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Enter title..."
            className="w-full text-3xl font-bold border-none focus:outline-none bg-transparent"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="text-sm text-gray-600">Slug:</label>
          <input
            type="text"
            value={contentData.slug}
            onChange={(e) =>
              setContentData((prev) => ({ ...prev, slug: e.target.value }))
            }
            placeholder="url-slug"
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Type and Status */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm text-gray-600">Type:</label>
            <select
              value={contentData.type}
              onChange={(e) =>
                setContentData((prev) => ({
                  ...prev,
                  type: e.target.value as ContentType,
                }))
              }
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="article">Article</option>
              <option value="page">Page</option>
              <option value="media">Media</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="text-sm text-gray-600">Status:</label>
            <select
              value={contentData.status}
              onChange={(e) =>
                setContentData((prev) => ({
                  ...prev,
                  status: e.target.value as ContentStatus,
                }))
              }
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Featured Image */}
        <div>
          <label className="text-sm text-gray-600">Featured Image URL:</label>
          <input
            type="text"
            value={contentData.featuredImage}
            onChange={(e) =>
              setContentData((prev) => ({
                ...prev,
                featuredImage: e.target.value,
              }))
            }
            placeholder="https://..."
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {contentData.featuredImage && (
            <img
              src={contentData.featuredImage}
              alt="Featured"
              className="mt-2 h-32 object-cover rounded"
            />
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="text-sm text-gray-600">Tags:</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) =>
                e.key === "Enter" && (e.preventDefault(), handleAddTag())
              }
              placeholder="Add tag..."
              className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddTag}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {contentData.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="text-blue-600 hover:text-blue-800">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Excerpt */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-600">Excerpt:</label>
            <button
              onClick={generateExcerpt}
              className="text-xs text-blue-600 hover:text-blue-800">
              Generate from content
            </button>
          </div>
          <textarea
            value={contentData.excerpt}
            onChange={(e) =>
              setContentData((prev) => ({ ...prev, excerpt: e.target.value }))
            }
            placeholder="Brief description..."
            rows={3}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Metadata Toggle */}
        <div>
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="text-sm text-blue-600 hover:text-blue-800">
            {showMetadata ? "− Hide" : "+ Show"} Custom Metadata (JSON)
          </button>
          {showMetadata && (
            <textarea
              value={JSON.stringify(contentData.metadata, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setContentData((prev) => ({ ...prev, metadata: parsed }));
                } catch (err) {
                  // Invalid JSON, ignore
                }
              }}
              rows={6}
              className="w-full mt-2 px-3 py-2 border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      </div>

      {/* Editor Toolbar */}
      <div className="editor-toolbar mb-4 flex flex-wrap gap-2 p-3 bg-gray-100 rounded-lg">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-3 py-1 rounded ${editor.isActive("bold") ? "bg-blue-600 text-white" : "bg-white"}`}>
          Bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-3 py-1 rounded ${editor.isActive("italic") ? "bg-blue-600 text-white" : "bg-white"}`}>
          Italic
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`px-3 py-1 rounded ${editor.isActive("strike") ? "bg-blue-600 text-white" : "bg-white"}`}>
          Strike
        </button>

        <div className="w-px bg-gray-300" />

        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={`px-3 py-1 rounded ${editor.isActive("heading", { level: 1 }) ? "bg-blue-600 text-white" : "bg-white"}`}>
          H1
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`px-3 py-1 rounded ${editor.isActive("heading", { level: 2 }) ? "bg-blue-600 text-white" : "bg-white"}`}>
          H2
        </button>
        <button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={`px-3 py-1 rounded ${editor.isActive("heading", { level: 3 }) ? "bg-blue-600 text-white" : "bg-white"}`}>
          H3
        </button>

        <div className="w-px bg-gray-300" />

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-3 py-1 rounded ${editor.isActive("bulletList") ? "bg-blue-600 text-white" : "bg-white"}`}>
          • List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-3 py-1 rounded ${editor.isActive("orderedList") ? "bg-blue-600 text-white" : "bg-white"}`}>
          1. List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-3 py-1 rounded ${editor.isActive("codeBlock") ? "bg-blue-600 text-white" : "bg-white"}`}>
          Code
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-3 py-1 rounded ${editor.isActive("blockquote") ? "bg-blue-600 text-white" : "bg-white"}`}>
          Quote
        </button>

        <div className="w-px bg-gray-300" />

        <button onClick={insertImage} className="px-3 py-1 rounded bg-white">
          🖼️ Image
        </button>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="px-3 py-1 rounded bg-white">
          ― HR
        </button>

        <div className="w-px bg-gray-300" />

        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="px-3 py-1 rounded bg-white disabled:opacity-50">
          ↶ Undo
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="px-3 py-1 rounded bg-white disabled:opacity-50">
          ↷ Redo
        </button>
      </div>

      {/* Editor Content */}
      <div className="editor-content border rounded-lg bg-white shadow-sm">
        <EditorContent editor={editor} />
      </div>

      {/* Word Count */}
      <div className="mt-4 text-sm text-gray-600 text-right">
        {editor.storage.characterCount?.characters() || 0} characters ·
        {editor.storage.characterCount?.words() || 0} words
      </div>
    </div>
  );
}
