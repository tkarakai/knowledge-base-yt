/** Server route helper. Never import into client components. */
const MAX_BODY = 2 * 1024 * 1024;
// Deliberately reject control bytes in every decoded URL segment.
// eslint-disable-next-line no-control-regex
const UNSAFE_SEGMENT = /[/\\\u0000-\u001f?#%]/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function error(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function allowedRoute(method: string, parts: string[]) {
  if (
    parts.some(
      (part) =>
        !part || part === "." || part === ".." || UNSAFE_SEGMENT.test(part),
    )
  )
    return false;
  const [resource, , operation, action] = parts;
  if (method === "GET")
    return (
      (parts.length === 3 && resource === "jobs" && parts[2] === "trace") ||
      (parts.length === 2 &&
        resource === "metadata" &&
        parts[1] === "status") ||
      (parts.length === 4 &&
        resource === "sources" &&
        operation === "media" &&
        ["thumbnail", "avatar"].includes(action)) ||
      (parts.length === 1 &&
        [
          "health",
          "metrics",
          "sources",
          "proposals",
          "knowledge",
          "search",
          "timeline",
          "jobs",
          "settings",
        ].includes(resource)) ||
      (parts.length === 2 &&
        ["sources", "knowledge", "documents"].includes(resource)) ||
      (parts.length === 2 &&
        resource === "history" &&
        parts[1] === "connection")
    );
  if (method === "PUT")
    return (
      (parts.length === 1 && resource === "settings") ||
      (parts.length === 2 && resource === "knowledge") ||
      (parts.length === 3 &&
        resource === "sources" &&
        ["reflection", "transcript"].includes(operation))
    );
  if (method === "POST")
    return (
      (parts.length === 3 &&
        resource === "settings" &&
        ["inference", "embeddings"].includes(parts[1]) &&
        operation === "check") ||
      (parts.length === 2 &&
        resource === "metadata" &&
        parts[1] === "refresh") ||
      (parts.length === 1 && ["sources", "documents"].includes(resource)) ||
      (parts.length === 2 &&
        resource === "history" &&
        ["pair-code", "disconnect"].includes(parts[1])) ||
      (parts.length === 2 && resource === "index" && parts[1] === "rebuild") ||
      (parts.length === 3 &&
        resource === "proposals" &&
        operation === "review") ||
      (parts.length === 3 &&
        resource === "sources" &&
        operation === "synthesize") ||
      (parts.length === 4 &&
        resource === "sources" &&
        operation === "transcript" &&
        action === "retry")
    );
  return false;
}

async function limitedBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > MAX_BODY) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function proxyCompanion(
  request: Request,
  parts: string[],
): Promise<Response> {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  let requestedHost: URL;
  try {
    requestedHost = new URL(`${url.protocol}//${host}`);
  } catch {
    return error("Local workspace host required.", 403);
  }
  if (
    !host ||
    requestedHost.host !== host ||
    !LOCAL_HOSTS.has(requestedHost.hostname) ||
    requestedHost.username ||
    requestedHost.password
  )
    return error("Local workspace host required.", 403);
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== `${url.protocol}//${host}`)
    return error("Request origin is not allowed.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return error("Cross-site requests are not allowed.", 403);
  if (request.method !== "GET" && !origin)
    return error("A same-origin request is required.", 403);
  if (!allowedRoute(request.method, parts))
    return error("Unknown workspace operation.", 404);

  const token = process.env.KB_COMPANION_TOKEN;
  if (!token)
    return error(
      "Local companion is not configured. Set KB_COMPANION_TOKEN on the web server and companion, then restart both.",
      503,
    );
  let companion: URL;
  try {
    companion = new URL(
      process.env.KB_COMPANION_URL ?? "http://127.0.0.1:4317",
    );
    if (
      companion.protocol !== "http:" ||
      companion.hostname !== "127.0.0.1" ||
      companion.username ||
      companion.password ||
      companion.pathname !== "/" ||
      companion.search ||
      companion.hash
    )
      throw new Error("Invalid companion address");
  } catch {
    return error(
      "KB_COMPANION_URL must be an HTTP loopback origin at 127.0.0.1.",
      503,
    );
  }
  let body: string | undefined;
  if (request.method !== "GET") {
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return error("Send application/json.", 415);
    const content = await limitedBody(request);
    if (content === null) return error("Content exceeds the 2 MiB limit.", 413);
    try {
      JSON.parse(content);
    } catch {
      return error("Request body must be valid JSON.", 400);
    }
    body = content;
  }
  const target = new URL(
    `/${parts.map(encodeURIComponent).join("/")}`,
    companion,
  );
  target.search = url.search;
  try {
    const response = await fetch(target, {
      // Bun's default socket idle timer is five minutes. The explicit request
      // deadline below must govern longer configured synthesis budgets.
      ...{ timeout: false },
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(
        parts.includes("synthesize")
          ? 630_000
          : parts.includes("rebuild") ||
              parts.includes("transcript") ||
              (request.method === "POST" && parts[0] === "sources")
            ? 180_000
            : 30_000,
      ),
    });
    if (response.status === 401 || response.status === 403)
      return error(
        "The local companion refused authentication. Check the server token configuration.",
        502,
      );
    if (parts[2] === "media" && response.ok) {
      const type = response.headers.get("content-type");
      if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type))
        return error("Invalid image response.", 502);
      const reader = response.body?.getReader();
      if (!reader) return error("Image unavailable.", 502);
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 1024 * 1024)
            return error("Image exceeds size limit.", 413);
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return new Response(bytes, {
        headers: {
          "Content-Type": type,
          "Cache-Control": "private, max-age=86400",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    // Reconstruct JSON: no upstream cookies/headers or credentials reach the browser.
    const payload: unknown = await response.json();
    const safePayload = JSON.parse(
      JSON.stringify(payload, (_key, value: unknown) =>
        typeof value === "string"
          ? value.split(token).join("[redacted]")
          : value,
      ),
    );
    const headers = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of [
      "X-KB-Retrieval-Mode",
      "X-KB-Retrieval-Reason",
      "Server-Timing",
    ]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value.split(token).join("[redacted]"));
    }
    return Response.json(safePayload, { status: response.status, headers });
  } catch {
    return error(
      "The local companion is unavailable or took too long to respond. Check that it is running on 127.0.0.1:4317, then retry.",
      503,
    );
  }
}
