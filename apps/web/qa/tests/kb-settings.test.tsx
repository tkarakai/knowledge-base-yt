import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SettingsView } from "../../src/components/kb/settings";

afterEach(() => vi.unstubAllGlobals());

test("reasoning and embedding checks have independent progress and feedback without saving", async () => {
  const settings = {
    vaultPath: "/test/vault",
    inference: {
      baseUrl: "http://localhost:1234/v1",
      model: "reasoning",
      apiKeyConfigured: true,
    },
    embeddings: {
      baseUrl: "http://localhost:1234/v1",
      model: "embedding",
      apiKeyConfigured: true,
    },
    network: { youtube: true, inference: true, embeddings: true },
    gitAutoCommit: false,
  };
  let finishReasoning!: (response: Response) => void;
  const reasoning = new Promise<Response>((resolve) => {
    finishReasoning = resolve;
  });
  const fetchMock = vi.fn(
    async (url: string, options: { method: string; body?: string }) => {
      if (url === "/api/kb/settings/inference/check") {
        expect(JSON.parse(options.body!)).toEqual({
          ...settings.inference,
          apiKey: "",
          apiKeyConfigured: undefined,
        });
        return reasoning;
      }
      if (url === "/api/kb/settings/embeddings/check") {
        expect(JSON.parse(options.body!).apiKey).toBe("draft-key");
        return Response.json(
          {
            error:
              "Connection check failed (HTTP 401). Check the API key and its access to this model.",
          },
          { status: 502 },
        );
      }
      if (url === "/api/kb/settings" && options.method === "GET")
        return Response.json(settings);
      if (url === "/api/kb/jobs") return Response.json([]);
      if (url === "/api/kb/health") return Response.json({ ok: true });
      if (url === "/api/kb/history/connection")
        return Response.json({ connected: false });
      throw new Error(`Unexpected request: ${options.method} ${url}`);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<SettingsView onSaved={() => {}} />);
  const checkReasoning = await screen.findByRole("button", {
    name: "Check reasoning model connection",
  });
  const checkEmbeddings = screen.getByRole("button", {
    name: "Check embedding model connection",
  });
  fireEvent.click(checkReasoning);
  expect(checkReasoning).toBeDisabled();
  expect(checkReasoning).toHaveTextContent("Checking…");
  expect(checkEmbeddings).toBeEnabled();
  fireEvent.change(screen.getAllByLabelText("API key", { exact: false })[1]!, {
    target: { value: "draft-key" },
  });
  fireEvent.click(checkEmbeddings);
  await screen.findByText(/Connection check failed/);
  finishReasoning(Response.json({ ok: true }));
  await screen.findByText(
    "Reasoning model connected. A test reply was received.",
  );
  expect(screen.getByText(/Connection check failed/)).toBeVisible();
  expect(
    fetchMock.mock.calls.some(([, options]) => options.method === "PUT"),
  ).toBe(false);
  fireEvent.change(screen.getAllByLabelText("Model name")[0]!, {
    target: { value: "different-model" },
  });
  expect(
    screen.queryByText("Reasoning model connected. A test reply was received."),
  ).toBeNull();
});

test("saved keys are visibly confirmed after saving and reopening settings", async () => {
  let settings = {
    vaultPath: "/test/vault",
    inference: {
      baseUrl: "http://localhost:11434/v1",
      model: "reasoning",
      contextWindow: 32768 as number | undefined,
      apiKeyConfigured: false,
    },
    embeddings: {
      baseUrl: "http://localhost:11434/v1",
      model: "embedding",
      apiKeyConfigured: false,
    },
    network: { youtube: true, inference: true, embeddings: false },
    gitAutoCommit: false,
  };
  const fetchMock = vi.fn(
    async (url: string, options: { method: string; body?: string }) => {
      if (url === "/api/kb/settings") {
        if (options.method === "PUT") {
          const body = JSON.parse(options.body as string);
          expect(body.inference.apiKey).toBe("new-reasoning-key");
          expect(body.embeddings.apiKey).toBe("new-embedding-key");
          expect(body.inference.contextWindow).toBeNull();
          settings = {
            ...settings,
            inference: {
              ...settings.inference,
              contextWindow: undefined,
              apiKeyConfigured: true,
            },
            embeddings: { ...settings.embeddings, apiKeyConfigured: true },
          };
        }
        return Response.json(settings);
      }
      if (url === "/api/kb/jobs") return Response.json([]);
      if (url === "/api/kb/health") return Response.json({ ok: true });
      if (url === "/api/kb/history/connection")
        return Response.json({ connected: false });
      throw new Error(`Unexpected request: ${url}`);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<SettingsView onSaved={() => {}} />);
  await screen.findAllByText(/No API key saved/);
  const keys = screen.getAllByLabelText("API key", { exact: false });
  fireEvent.change(keys[0]!, { target: { value: "new-reasoning-key" } });
  fireEvent.change(keys[1]!, { target: { value: "new-embedding-key" } });
  fireEvent.change(screen.getByLabelText(/Context window/), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
  await screen.findByText("Workspace settings saved.");
  expect(screen.getAllByText(/API key saved\./)).toHaveLength(2);
  expect(keys[0]).toHaveValue("");
  expect(keys[1]).toHaveValue("");
  expect(screen.getAllByPlaceholderText("••••••••••••")).toHaveLength(2);
  view.unmount();
  render(<SettingsView onSaved={() => {}} />);
  await waitFor(() =>
    expect(screen.getAllByText(/API key saved\./)).toHaveLength(2),
  );
  expect(screen.getByLabelText(/Context window/)).toHaveValue(null);
  expect(screen.getAllByPlaceholderText("••••••••••••")).toHaveLength(2);
  expect(screen.getAllByLabelText("API key", { exact: false })[0]).toHaveValue(
    "",
  );
});
