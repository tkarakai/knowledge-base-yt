import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { JobTrace } from "../../src/components/kb/job-trace";

afterEach(() => vi.unstubAllGlobals());
test("job trace loads on expansion and displays provider and validation details", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({
      events: [
        {
          at: "2026-09-17T12:00:00Z",
          type: "llm_http_error",
          data: { status: 400, body: "Context length exceeded" },
        },
        {
          at: "2026-09-17T12:00:01Z",
          type: "run_failed",
          data: { code: "CONTEXT_LIMIT" },
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const { container } = render(
    <JobTrace
      job={{
        id: "job:one",
        traceId: "trace-one",
        type: "run_synthesis",
        state: "failed",
        errorCode: "CONTEXT_LIMIT",
        createdAt: "",
        updatedAt: "",
      }}
    />,
  );
  expect(fetchMock).not.toHaveBeenCalled();
  const details = container.querySelector("details")!;
  await act(async () => {
    details.open = true;
  });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(
    await screen.findByText(/Context length exceeded/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Download JSONL" }),
  ).toBeInTheDocument();
});
