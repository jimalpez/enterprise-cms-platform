import React, { useState } from "react";

interface Article {
  id: string;
  title: string;
  slug: string;
  status: "published" | "draft" | "archived";
  createdAt: string;
}

interface RecentArticlesProps {
  articles: Article[];
}

const statusStyles = {
  published:
    "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  draft:
    "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  archived:
    "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
};

export default function RecentArticles({ articles }: RecentArticlesProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <svg
            className="h-8 w-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          No articles yet
        </h3>
        <p className="mb-4 text-center text-sm text-muted-foreground">
          Get started by creating your first article
        </p>
        <a
          href="/dashboard/blog/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Article
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {articles.map((article) => (
        <div
          key={article.id}
          onMouseEnter={() => setHoveredId(article.id)}
          onMouseLeave={() => setHoveredId(null)}
          className={`group relative flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-all ${
            hoveredId === article.id ? "shadow-md" : "shadow-sm"
          }`}>
          <div className="flex-1 space-y-1">
            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {article.title}
            </h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <time dateTime={article.createdAt}>
                {formatDate(article.createdAt)}
              </time>
              <span>•</span>
              <span
                className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${statusStyles[article.status]}`}>
                {article.status.charAt(0).toUpperCase() +
                  article.status.slice(1)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={`/dashboard/blog/${article.id}/edit`}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
              title="Edit article">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </a>
            <a
              href={`/blog/${article.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
              title="View article">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
