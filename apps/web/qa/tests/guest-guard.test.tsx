import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// --- Mocks ---

let broadcastCallback: (() => void) | null = null;
const mockBroadcastCleanup = vi.fn();

vi.mock("@/lib/auth-broadcast", () => ({
  onAuthBroadcast: (cb: () => void) => {
    broadcastCallback = cb;
    return mockBroadcastCleanup;
  },
}));

const mockGetSession = vi.fn();
vi.mock("@repo/auth/client", () => ({
  authClient: {
    getSession: () => mockGetSession(),
  },
}));

// Mock window.location.replace
const mockLocationReplace = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  Object.defineProperty(window, "location", {
    value: { ...originalLocation, replace: mockLocationReplace },
    writable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    value: originalLocation,
    writable: true,
  });
});

// --- Import after mocks ---

import { GuestGuard } from "@/components/auth/guest-guard";

describe("GuestGuard", () => {
  beforeEach(() => {
    broadcastCallback = null;
    mockBroadcastCleanup.mockClear();
    mockGetSession.mockClear();
    mockLocationReplace.mockClear();
    mockGetSession.mockResolvedValue({ data: null });
  });

  it("renders children normally", () => {
    render(
      <GuestGuard>
        <div>Sign in form</div>
      </GuestGuard>
    );

    expect(screen.getByText("Sign in form")).toBeInTheDocument();
    expect(mockLocationReplace).not.toHaveBeenCalled();
  });

  it("subscribes to auth broadcasts on mount", () => {
    render(
      <GuestGuard>
        <div>Content</div>
      </GuestGuard>
    );

    expect(broadcastCallback).toBeTypeOf("function");
  });

  it("redirects to /dashboard when broadcast is received", async () => {
    render(
      <GuestGuard>
        <div>Content</div>
      </GuestGuard>
    );

    // Simulate broadcast from another tab
    await act(async () => {
      broadcastCallback?.();
    });

    expect(mockLocationReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects on visibility change when session exists", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { id: "session-123" } },
    });

    render(
      <GuestGuard>
        <div>Content</div>
      </GuestGuard>
    );

    // Simulate tab becoming visible
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockGetSession).toHaveBeenCalled();
    expect(mockLocationReplace).toHaveBeenCalledWith("/dashboard");
  });

  it("does NOT redirect on visibility change when no session", async () => {
    mockGetSession.mockResolvedValue({ data: null });

    render(
      <GuestGuard>
        <div>Content</div>
      </GuestGuard>
    );

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockGetSession).toHaveBeenCalled();
    expect(mockLocationReplace).not.toHaveBeenCalled();
  });

  it("ignores visibility change when tab is hidden", async () => {
    render(
      <GuestGuard>
        <div>Content</div>
      </GuestGuard>
    );

    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("cleans up broadcast listener and visibility handler on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = render(
      <GuestGuard>
        <div>Content</div>
      </GuestGuard>
    );

    unmount();

    expect(mockBroadcastCleanup).toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );

    removeEventListenerSpy.mockRestore();
  });
});
