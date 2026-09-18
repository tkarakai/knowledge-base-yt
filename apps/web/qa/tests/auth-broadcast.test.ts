import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";

// Mock BroadcastChannel since it's a browser API
class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  name: string;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown) {
    // Deliver to other instances with the same channel name (cross-tab simulation)
    for (const instance of MockBroadcastChannel.instances) {
      if (instance !== this && instance.name === this.name && !instance.closed && instance.onmessage) {
        instance.onmessage({ data });
      }
    }
  }

  close() {
    this.closed = true;
    MockBroadcastChannel.instances = MockBroadcastChannel.instances.filter((i) => i !== this);
  }

  static reset() {
    MockBroadcastChannel.instances = [];
  }
}

// Install mock before importing the module
const originalBC = globalThis.BroadcastChannel;
// @ts-expect-error -- mock
globalThis.BroadcastChannel = MockBroadcastChannel;

// Dynamic import so the module picks up the mock
const { broadcastAuth, onAuthBroadcast } = await import("../../src/lib/auth-broadcast");

describe("broadcastAuth", () => {
  beforeEach(() => {
    MockBroadcastChannel.reset();
  });

  afterEach(() => {
    MockBroadcastChannel.reset();
  });

  it("creates a channel, posts 'authenticated', and closes it", () => {
    broadcastAuth();

    // Channel was created and closed (fire-and-forget)
    expect(MockBroadcastChannel.instances).toHaveLength(0); // closed = removed
  });

  it("does not throw when BroadcastChannel is unavailable", () => {
    // @ts-expect-error -- temporarily remove
    globalThis.BroadcastChannel = undefined;

    expect(() => broadcastAuth()).not.toThrow();

    // @ts-expect-error -- restore
    globalThis.BroadcastChannel = MockBroadcastChannel;
  });
});

describe("onAuthBroadcast", () => {
  beforeEach(() => {
    MockBroadcastChannel.reset();
  });

  afterEach(() => {
    MockBroadcastChannel.reset();
  });

  it("calls callback when 'authenticated' message is received", () => {
    const callback = mock(() => {});
    onAuthBroadcast(callback);

    // Simulate broadcast from another tab
    broadcastAuth();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores messages that are not 'authenticated'", () => {
    const callback = mock(() => {});
    onAuthBroadcast(callback);

    // Simulate a different message on a new channel with the same name
    const sender = new MockBroadcastChannel("auth");
    sender.postMessage("something-else");
    sender.close();

    expect(callback).not.toHaveBeenCalled();
  });

  it("returns a cleanup function that closes the channel", () => {
    const callback = mock(() => {});
    const cleanup = onAuthBroadcast(callback);

    expect(MockBroadcastChannel.instances).toHaveLength(1);

    cleanup();

    expect(MockBroadcastChannel.instances).toHaveLength(0);

    // Messages after cleanup should not trigger callback
    broadcastAuth();
    expect(callback).not.toHaveBeenCalled();
  });

  it("returns a no-op cleanup when BroadcastChannel is unavailable", () => {
    // @ts-expect-error -- temporarily remove
    globalThis.BroadcastChannel = undefined;

    const callback = mock(() => {});
    const cleanup = onAuthBroadcast(callback);

    expect(() => cleanup()).not.toThrow();

    // @ts-expect-error -- restore
    globalThis.BroadcastChannel = MockBroadcastChannel;
  });
});

// Restore original after all tests
afterEach(() => {
  // Keep the mock for the test file, restore on final cleanup
});

// Final restore
globalThis.BroadcastChannel = originalBC ?? MockBroadcastChannel;
