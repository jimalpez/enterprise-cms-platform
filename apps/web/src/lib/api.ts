// apps/web/src/lib/api.ts
import axios from "axios";
import type { Content, ApiResponse, PaginatedResponse } from "@cms/shared";

const API_URL = import.meta.env.PUBLIC_API_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests if available
if (typeof window !== "undefined") {
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

// Content API
export const contentApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
  }) => {
    const { data } = await api.get<ApiResponse<PaginatedResponse<Content>>>(
      "/content",
      { params },
    );
    return data.data!;
  },

  getById: async (id: string) => {
    const { data } = await api.get<ApiResponse<Content>>(`/content/${id}`);
    return data.data!;
  },

  getBySlug: async (slug: string) => {
    const response = await api.get<ApiResponse<PaginatedResponse<Content>>>(
      "/content",
      {
        params: { limit: 1 },
      },
    );

    // Find by slug in the results
    const content = response.data.data!.items.find((c) => c.slug === slug);
    if (!content) {
      throw new Error("Content not found");
    }

    return api
      .get<ApiResponse<Content>>(`/content/${content.id}`)
      .then((r) => r.data.data!);
  },

  create: async (data: any) => {
    const response = await api.post<ApiResponse<Content>>("/content", data);
    return response.data.data!;
  },

  update: async (id: string, data: any) => {
    const response = await api.put<ApiResponse<Content>>(
      `/content/${id}`,
      data,
    );
    return response.data.data!;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/content/${id}`);
    return response.data;
  },

  publish: async (id: string) => {
    const response = await api.post<ApiResponse<Content>>(
      `/content/${id}/publish`,
    );
    return response.data.data!;
  },
};

// Search API
export const searchApi = {
  search: async (params: {
    q?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) => {
    const { data } = await api.get<ApiResponse<PaginatedResponse<Content>>>(
      "/search",
      { params },
    );
    return data.data!;
  },
};

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (typeof window !== "undefined" && data.data) {
      localStorage.setItem("accessToken", data.data.accessToken);
      localStorage.setItem("refreshToken", data.data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.data.user));
    }
    return data.data;
  },

  register: async (email: string, password: string, name: string) => {
    const { data } = await api.post("/auth/register", {
      email,
      password,
      name,
    });
    if (typeof window !== "undefined" && data.data) {
      localStorage.setItem("accessToken", data.data.accessToken);
      localStorage.setItem("refreshToken", data.data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.data.user));
    }
    return data.data;
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    }
  },

  getUser: () => {
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("user");
      return user ? JSON.parse(user) : null;
    }
    return null;
  },
};
