// apps/web/src/components/react/LoginForm.tsx
import { useState, type FormEvent } from "react";
import { authApi } from "@/lib/api";

interface LoginFormProps {
  redirectTo?: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginForm({
  redirectTo = "/dashboard",
}: LoginFormProps) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    // Basic validation
    const newErrors: FormErrors = {};
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      // authApi.login() already handles storing tokens and user in localStorage
      const data = await authApi.login(formData.email, formData.password);

      if (data && data.accessToken) {
        // CRITICAL: Set cookie for server-side Astro pages
        // Create a cookie that Astro can read server-side
        document.cookie = `accessToken=${data.accessToken}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `user=${encodeURIComponent(JSON.stringify(data.user))}; path=/; max-age=604800; SameSite=Lax`;

        // Get redirect URL from query params or use default
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get("redirect") || redirectTo;

        // Small delay to ensure cookies are set
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Force full page reload to ensure Astro server-side check runs
        window.location.href = redirect;
      }
    } catch (error: any) {
      console.error("Login error:", error);

      const status = error.response?.status;
      const data = error.response?.data;

      // Handle API response errors matching your Next.js API
      if (status === 400 && data?.errors) {
        // Validation errors: { success: false, errors: { field: ["message"] } }
        const backendErrors: FormErrors = {};
        Object.entries(data.errors).forEach(([key, messages]) => {
          backendErrors[key as keyof FormErrors] = (messages as string[])[0];
        });
        setErrors(backendErrors);
      } else if (status === 401) {
        // Auth error: { success: false, error: "Invalid credentials" }
        setErrors({ general: data?.error || "Invalid email or password" });
      } else if (status === 429) {
        // Rate limit: { success: false, error: "Too many login attempts..." }
        setErrors({
          general:
            data?.error || "Too many login attempts. Please try again later.",
        });
      } else {
        // Generic error
        setErrors({
          general:
            data?.error || "An error occurred during login. Please try again.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white shadow-lg rounded-lg p-8">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-2">
            Sign in to your account
          </h2>
          <p className="text-sm text-gray-600 text-center">
            Enter your credentials to access your account
          </p>
        </div>

        {/* General Error Alert */}
        {errors.general && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">
                  {errors.general}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Email Field */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleChange}
            className={`w-full px-3 py-2 border ${
              errors.email ? "border-red-300" : "border-gray-300"
            } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            placeholder="you@example.com"
            disabled={isLoading}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={formData.password}
            onChange={handleChange}
            className={`w-full px-3 py-2 border ${
              errors.password ? "border-red-300" : "border-gray-300"
            } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            placeholder="Enter your password"
            disabled={isLoading}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password}</p>
          )}
        </div>

        {/* Forgot Password Link */}
        <div className="flex items-center justify-end">
          <a
            href="/forgot-password"
            className="text-sm font-medium text-blue-600 hover:text-blue-500">
            Forgot your password?
          </a>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition ${
            isLoading
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}>
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>

        {/* Sign Up Link */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{" "}
            <a
              href="/register"
              className="font-medium text-blue-600 hover:text-blue-500">
              Sign up
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}
