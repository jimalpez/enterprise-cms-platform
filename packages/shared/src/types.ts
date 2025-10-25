// User and Authentication Types
export type UserRole = "admin" | "editor" | "author" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthPayload {
  user: {
    id: string;
    email: string;
    role: UserRole;
    permissions: string[];
  };
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// Content Types
export type ContentStatus = "draft" | "published" | "archived";
export type ContentType = "article" | "page" | "media";

export interface Content {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  type: ContentType;
  status: ContentStatus;
  authorId: string;
  author?: User;
  featuredImage?: string;
  tags: string[];
  metadata: Record<string, any>;
  version: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentVersion {
  id: string;
  contentId: string;
  version: number;
  data: any;
  createdBy: string;
  createdAt: Date;
  publishedAt?: Date;
}

export interface CreateContentRequest {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  type: ContentType;
  status: ContentStatus;
  featuredImage?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateContentRequest extends Partial<CreateContentRequest> {
  version?: number;
}

// Comment Types
export interface Comment {
  id: string;
  contentId: string;
  userId: string;
  user?: User;
  parentId?: string;
  text: string;
  likes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentRequest {
  contentId: string;
  text: string;
  parentId?: string;
}

// Media Types
export interface Media {
  id: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  uploadedBy: string;
  createdAt: Date;
}

// Search Types
export interface SearchQuery {
  q: string;
  type?: ContentType;
  author?: string;
  tags?: string[];
  status?: ContentStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Permissions
export const PERMISSIONS = {
  admin: ["*"],
  editor: ["content:*", "media:*", "comments:moderate"],
  author: ["content:create", "content:edit:own", "media:upload"],
  viewer: ["content:read", "comments:create"],
} as const;

// Rate Limit Types
export interface RateLimitConfig {
  anonymous: number;
  authenticated: number;
  api_key: number;
}

// Validation Types
export interface ValidationError {
  field: string;
  message: string;
}

// WebSocket Event Types
export type WSEventType =
  | "content:created"
  | "content:updated"
  | "content:deleted"
  | "comment:created";

export interface WSEvent {
  type: WSEventType;
  payload: any;
  timestamp: Date;
}
