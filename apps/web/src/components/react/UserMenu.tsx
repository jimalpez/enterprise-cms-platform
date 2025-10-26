// src/components/UserMenu.tsx
import { useState, useEffect, useRef } from "react";
import { authApi } from "@/lib/api";

interface UserMenuProps {
  currentPath?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

export default function UserMenu({ currentPath }: UserMenuProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const checkAuth = () => {
    try {
      const currentUser = authApi.getUser();
      setUser(currentUser);
    } catch (error) {
      console.error("Auth check error:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Call Astro logout API to clear cookies
      const response = await fetch("/api/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        // Clear client-side auth state
        authApi.logout();
        setUser(null);
        setIsDropdownOpen(false);

        // Redirect to login page
        window.location.href = "/login";
      } else {
        throw new Error("Logout failed");
      }
    } catch (error) {
      console.error("Logout error:", error);

      // Even if API call fails, clear client-side data and redirect
      authApi.logout();
      setUser(null);
      setIsDropdownOpen(false);
      window.location.href = "/login";
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
      </div>
    );
  }

  // Not logged in - Show Login/Register buttons
  if (!user) {
    return (
      <div className="flex items-center space-x-3">
        <a
          href="/login"
          className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
            currentPath === "/login"
              ? "text-primary-600 bg-primary-50"
              : "text-gray-700 hover:text-primary-600"
          }`}>
          Login
        </a>
      </div>
    );
  }

  // Logged in - Show user menu
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-lg px-3 py-2 transition-all hover:bg-gray-50"
        aria-expanded={isDropdownOpen}
        aria-haspopup="true">
        {/* Avatar */}
        <div className="relative">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center border-2 border-primary-200">
              <span className="text-white font-semibold text-xs">
                {getUserInitials(user.name)}
              </span>
            </div>
          )}
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full"></div>
        </div>

        {/* User info */}
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-gray-900 leading-none">
            {user.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{user.role}</p>
        </div>

        {/* Dropdown arrow */}
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isDropdownOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 animate-fadeIn">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500 mt-1">{user.email}</p>
            <span className="inline-block mt-2 px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded">
              {user.role}
            </span>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <a
              href="/dashboard"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <svg
                className="w-4 h-4 mr-3 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Dashboard
            </a>

            <a
              href="/dashboard/profile"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <svg
                className="w-4 h-4 mr-3 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Profile Settings
            </a>

            <a
              href="/dashboard/content"
              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <svg
                className="w-4 h-4 mr-3 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              My Content
            </a>
          </div>

          <div className="border-t border-gray-200 py-1">
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
              <svg
                className="w-4 h-4 mr-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
