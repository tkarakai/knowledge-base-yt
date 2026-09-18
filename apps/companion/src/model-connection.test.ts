import { expect, test } from "bun:test";
import { checkModelConnection } from "./model-connection";

const config = {
  baseUrl: "http://localhost:1234/v1",
  model: "test",
  apiKey: "secret",
};

test("invalid provider responses never count as a successful model connection", async () => {
  for (const kind of ["inference", "embeddings"] as const) {
    for (const response of [
      new Response("<html>secret</html>"),
      Response.json({ error: "secret" }),
      Response.json({
        choices: [{ message: { content: "" } }],
        data: [{ embedding: [] }],
      }),
      new Response("x".repeat(1024 * 1024 + 1)),
    ]) {
      await expect(
        checkModelConnection(kind, config, {
          fetch: (async () => response) as unknown as typeof fetch,
        }),
      ).rejects.toMatchObject({ status: 502 });
    }
  }
});

test("timeouts and transport errors produce actionable errors without credentials", async () => {
  await expect(
    checkModelConnection("inference", config, {
      timeoutMs: 5,
      fetch: ((_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new Error("secret")),
            { once: true },
          );
        })) as typeof fetch,
    }),
  ).rejects.toMatchObject({
    status: 504,
    message: expect.stringContaining("timed out"),
  });
  await expect(
    checkModelConnection("embeddings", config, {
      fetch: (async () => {
        throw new Error("secret");
      }) as unknown as typeof fetch,
    }),
  ).rejects.toMatchObject({
    status: 502,
    message:
      "Could not reach the model endpoint. Check the base URL and that the server is running.",
  });
});
