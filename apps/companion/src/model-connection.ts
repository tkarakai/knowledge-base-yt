import type { ModelConfig } from "@repo/kb-shared";
import { ApiError } from "./state";

export async function checkModelConnection(
  kind: "inference" | "embeddings",
  config: ModelConfig,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
) {
  if (!config.baseUrl.trim() || !config.model.trim())
    throw new ApiError(
      400,
      "Enter a base URL and model name before checking the connection.",
    );
  const signal = AbortSignal.timeout(options.timeoutMs ?? 20_000);
  try {
    const response = await (options.fetch ?? fetch)(
      `${config.baseUrl.replace(/\/+$/, "")}/${kind === "inference" ? "chat/completions" : "embeddings"}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey
            ? { Authorization: `Bearer ${config.apiKey}` }
            : {}),
        },
        body: JSON.stringify(
          kind === "inference"
            ? {
                model: config.model,
                messages: [{ role: "user", content: "Reply with OK." }],
                max_tokens: 64,
                stream: false,
              }
            : { model: config.model, input: ["Connection test."] },
        ),
        redirect: "error",
        signal,
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      const hint =
        response.status === 401 || response.status === 403
          ? "Check the API key and its access to this model."
          : response.status === 404
            ? "Check the base URL and model name."
            : response.status === 429
              ? "Check the provider quota or retry shortly."
              : "Check the model name and endpoint compatibility, then retry.";
      throw new ApiError(
        502,
        `Connection check failed (HTTP ${response.status}). ${hint}`,
      );
    }
    const reader = response.body?.getReader();
    if (!reader)
      throw new ApiError(502, "The model returned an empty response.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1024 * 1024) {
        await reader.cancel();
        throw new ApiError(
          502,
          "The model returned an unexpectedly large test response.",
        );
      }
      chunks.push(value);
    }
    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new ApiError(
        502,
        "The endpoint did not return JSON. Check the base URL.",
      );
    }
    const vector = payload?.data?.[0]?.embedding;
    const valid =
      kind === "inference"
        ? Array.isArray(payload?.choices) &&
          payload.choices.some(
            (choice: { message?: { content?: unknown } } | null) =>
              typeof choice?.message?.content === "string" &&
              choice.message.content.trim().length > 0,
          )
        : Array.isArray(vector) &&
          vector.length > 0 &&
          vector.every(
            (value: unknown) =>
              typeof value === "number" && Number.isFinite(value),
          );
    if (!valid)
      throw new ApiError(
        502,
        `The endpoint did not return a valid ${kind === "inference" ? "chat completion" : "embedding"}. Check the model and base URL.`,
      );
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal.aborted)
      throw new ApiError(
        504,
        "Connection check timed out. Check that the model is running, then retry.",
      );
    // Do not expose provider bodies or transport errors; either may contain credentials.
    throw new ApiError(
      502,
      "Could not reach the model endpoint. Check the base URL and that the server is running.",
    );
  }
}
