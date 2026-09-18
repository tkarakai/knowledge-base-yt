const CHANNEL_NAME = "auth";

/** Notify other tabs that the user just authenticated. */
export function broadcastAuth(): void {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage("authenticated");
    ch.close();
  } catch {
    // BroadcastChannel unavailable (e.g. SSR or unsupported browser).
  }
}

/** Subscribe to auth broadcasts from other tabs. Returns a cleanup function. */
export function onAuthBroadcast(callback: () => void): () => void {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = (event) => {
      if (event.data === "authenticated") {
        callback();
      }
    };
    return () => ch.close();
  } catch {
    return () => {};
  }
}
