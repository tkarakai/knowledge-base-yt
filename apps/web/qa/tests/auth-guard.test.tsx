import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// --- Mocks ---

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

type MockUser = {
  name: string;
  email: string;
  role?: string;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
};

let mockUser: MockUser | null = {
  name: "Test User",
  email: "test@example.com",
  role: "user",
  emailVerified: true,
  twoFactorEnabled: true,
};
vi.mock("@convex-dev/better-auth/nextjs/client", () => ({
  usePreloadedAuthQuery: () => mockUser,
}));

let mockPublicSettings: Record<string, unknown> = {};
vi.mock("convex/react", () => ({
  useQuery: (_query: unknown, args: { key: string }) => mockPublicSettings[args.key],
}));

let mockSession: { isPending: boolean; data: { user: { name: string; email: string }; session: object } | null } = {
  isPending: false,
  data: { user: { name: "Test User", email: "test@example.com" }, session: {} },
};
const mockListUserPasskeys = vi.fn(async () => ({ data: [{ id: "pk-1" }] }));
vi.mock("@repo/auth/client", () => ({
  authClient: {
    useSession: () => mockSession,
    passkey: {
      listUserPasskeys: () => mockListUserPasskeys(),
    },
  },
}));

// Mock i18n hook
vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

// --- Import after mocks ---

import { AuthGuard, useAuthUser } from "@/components/auth/auth-guard";

// Helper component to read context
function UserDisplay() {
  const user = useAuthUser();
  return (
    <div>
      <span data-testid="name">{user?.name ?? "none"}</span>
      <span data-testid="email">{user?.email ?? "none"}</span>
    </div>
  );
}

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReplace.mockClear();
    mockUser = {
      name: "Test User",
      email: "test@example.com",
      role: "user",
      emailVerified: true,
      twoFactorEnabled: true,
    };
    mockPublicSettings = {};
    mockListUserPasskeys.mockReset();
    mockListUserPasskeys.mockResolvedValue({ data: [{ id: "pk-1" }] });
    mockSession = {
      isPending: false,
      data: { user: { name: "Test User", email: "test@example.com" }, session: {} },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders children when authenticated", () => {
    render(
      <AuthGuard preloadedUser={{} as never}>
        <div>Dashboard content</div>
      </AuthGuard>
    );

    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("provides user data via useAuthUser context", () => {
    render(
      <AuthGuard preloadedUser={{} as never}>
        <UserDisplay />
      </AuthGuard>
    );

    expect(screen.getByTestId("name")).toHaveTextContent("Test User");
    expect(screen.getByTestId("email")).toHaveTextContent("test@example.com");
  });

  it("redirects when Convex user becomes null (signed out in another tab)", async () => {
    const { rerender } = render(
      <AuthGuard preloadedUser={{} as never}>
        <div>Content</div>
      </AuthGuard>
    );

    // First render with user → wasAuthenticated becomes true
    await act(async () => {});

    // Simulate Convex pushing null user
    mockUser = null;
    rerender(
      <AuthGuard preloadedUser={{} as never}>
        <div>Content</div>
      </AuthGuard>
    );

    // Advance past the 3-second debounce that prevents false redirects
    // during transient session refreshes (e.g. password change, 2FA toggle)
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("redirects when Better Auth session becomes null", async () => {
    const { rerender } = render(
      <AuthGuard preloadedUser={{} as never}>
        <div>Content</div>
      </AuthGuard>
    );

    await act(async () => {});

    // Simulate full sign-out: both Convex user and session become null.
    // The component uses the Convex user as the authoritative redirect signal.
    mockUser = null;
    mockSession = { isPending: false, data: null };
    rerender(
      <AuthGuard preloadedUser={{} as never}>
        <div>Content</div>
      </AuthGuard>
    );

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("does NOT redirect during initial load when session is pending", async () => {
    mockSession = { isPending: true, data: null };
    mockUser = null;

    render(
      <AuthGuard preloadedUser={{} as never}>
        <div>Content</div>
      </AuthGuard>
    );

    await act(async () => {});

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("falls back to session data when Convex user is null but session exists", () => {
    mockUser = null;
    mockSession = {
      isPending: false,
      data: { user: { name: "Session User", email: "session@example.com" }, session: {} },
    };

    render(
      <AuthGuard preloadedUser={{} as never}>
        <UserDisplay />
      </AuthGuard>
    );

    expect(screen.getByTestId("name")).toHaveTextContent("Session User");
    expect(screen.getByTestId("email")).toHaveTextContent("session@example.com");
  });

  it("redirects to security settings when MFA is required but not enabled", async () => {
    mockPublicSettings.userMfaRequired = true;
    mockPublicSettings.userPasskeyPolicy = "optional";
    mockUser = {
      name: "Test User",
      email: "test@example.com",
      role: "user",
      emailVerified: true,
      twoFactorEnabled: false,
    };

    render(
      <AuthGuard preloadedUser={{} as never}>
        <div>Content</div>
      </AuthGuard>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockReplace).toHaveBeenCalledWith("/dashboard/settings?tab=security&enforce=mfa");
  });

  it("redirects to security settings when passkey is required but none exist", async () => {
    mockPublicSettings.userMfaRequired = false;
    mockPublicSettings.userPasskeyPolicy = "required";
    mockListUserPasskeys.mockResolvedValue({ data: [] });

    render(
      <AuthGuard preloadedUser={{} as never}>
        <div>Content</div>
      </AuthGuard>
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockReplace).toHaveBeenCalledWith("/dashboard/settings?tab=security&enforce=passkey");
  });
});
