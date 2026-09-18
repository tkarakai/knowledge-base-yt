/**
 * Authentication Mock Helpers for Testing
 *
 * This module provides utilities for mocking authentication state in tests.
 * Use these helpers when testing components that depend on user authentication.
 *
 * @module tests/helpers/auth-mock
 */

import { vi } from "vitest";

/**
 * Mock user data for testing authenticated scenarios
 */
export interface MockUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  emailVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mock session data for testing authenticated scenarios
 */
export interface MockSession {
  user: MockUser;
  expires: Date;
  sessionToken: string;
}

/**
 * Default mock user for tests
 */
export const defaultMockUser: MockUser = {
  id: "test-user-id-123",
  email: "test@example.com",
  name: "Test User",
  image: "https://example.com/avatar.png",
  emailVerified: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

/**
 * Create a mock user with custom properties
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    ...defaultMockUser,
    ...overrides,
  };
}

/**
 * Create a mock session with custom properties
 */
export function createMockSession(
  user: MockUser = defaultMockUser,
  overrides: Partial<Omit<MockSession, "user">> = {}
): MockSession {
  return {
    user,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    sessionToken: "mock-session-token-xyz",
    ...overrides,
  };
}

/**
 * Mock authenticated context for Convex functions
 * Use this when testing Convex queries/mutations that require authentication
 */
export interface MockAuthContext {
  userId: string;
  user: MockUser;
}

/**
 * Create a mock auth context for Convex testing
 */
export function createMockAuthContext(
  user: MockUser = defaultMockUser
): MockAuthContext {
  return {
    userId: user.id,
    user,
  };
}

/**
 * Mock the useAuth hook for component testing
 *
 * @example
 * ```tsx
 * import { mockUseAuth } from "@/tests/helpers/auth-mock";
 *
 * beforeEach(() => {
 *   mockUseAuth({ isAuthenticated: true });
 * });
 * ```
 */
export function mockUseAuth(state: {
  isAuthenticated: boolean;
  isLoading?: boolean;
  user?: MockUser | null;
}) {
  const mockAuth = {
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading ?? false,
    user: state.isAuthenticated ? (state.user ?? defaultMockUser) : null,
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    signUp: vi.fn().mockResolvedValue(undefined),
  };

  return mockAuth;
}

/**
 * Mock the session for API route testing
 */
export function createMockRequest(options: {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  authenticated?: boolean;
  user?: MockUser;
}) {
  const headers = new Headers(options.headers);

  if (options.authenticated) {
    headers.set("Authorization", `Bearer mock-token-${options.user?.id ?? defaultMockUser.id}`);
  }

  return new Request("http://localhost:3000/api/test", {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

/**
 * Test helper for Playwright E2E authentication
 * Use this in Playwright tests to set up authenticated state
 *
 * @example
 * ```ts
 * import { test } from "@playwright/test";
 * import { authenticatedState } from "./auth-mock";
 *
 * test.use({ storageState: authenticatedState });
 *
 * test("authenticated page", async ({ page }) => {
 *   await page.goto("/dashboard");
 *   // User is already logged in
 * });
 * ```
 */
export const playwrightAuthState = {
  cookies: [
    {
      name: "session_token",
      value: "mock-e2e-session-token",
      domain: "localhost",
      path: "/",
      expires: Date.now() / 1000 + 60 * 60 * 24, // 1 day
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    },
  ],
  origins: [],
};

/**
 * Mock Convex auth component for testing
 * Simulates the authComponent.getAuthUser function
 */
export function mockConvexAuthComponent() {
  return {
    getAuthUser: vi.fn().mockResolvedValue(defaultMockUser),
    adapter: vi.fn(),
  };
}
