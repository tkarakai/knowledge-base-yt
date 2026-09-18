import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { SynthesisProposal } from "@repo/kb-shared";
import { ProposalReview } from "../../src/components/kb/proposals";
import { Markdown } from "../../src/components/kb/common";
import { NoteEditor } from "../../src/components/kb/library";

const proposal: SynthesisProposal = {
  id: "proposal:test",
  sourceId: "youtube:test",
  createdAt: "2026-09-16T12:00:00Z",
  model: "test-model",
  summary: "Connect durable memory",
  whyItMatters: "Preserve source context",
  outcome: "changes",
  status: "pending",
  questions: [],
  changes: [
    {
      id: "change:one",
      operation: "create_note",
      knowledgeId: "knowledge:one",
      title: "First note",
      before: "",
      after: "# First note\n\nOriginal proposed text",
      rationale: "New connection",
      evidence: [
        {
          sourceId: "youtube:test",
          start: 12,
          end: 24,
          quote: "Original source",
        },
      ],
      decision: "pending",
    },
    {
      id: "change:two",
      operation: "patch_note",
      knowledgeId: "knowledge:two",
      title: "Second note",
      before: "Old text",
      after: "Proposed update",
      rationale: "Reinforce existing idea",
      evidence: [],
      decision: "pending",
    },
  ],
};
afterEach(() => vi.unstubAllGlobals());

describe("Knowledge review workflow", () => {
  it("submits exact user edits and granular decisions only on explicit apply", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...proposal, status: "partially_accepted" }),
      );
    vi.stubGlobal("fetch", fetcher);
    const reviewed = vi.fn();
    render(<ProposalReview proposal={proposal} onReviewed={reviewed} />);
    const first = within(
      screen.getByRole("region", { name: "Change 1: First note" }),
    );
    const second = within(
      screen.getByRole("region", { name: "Change 2: Second note" }),
    );
    fireEvent.click(first.getByRole("button", { name: "Edit Markdown" }));
    fireEvent.change(first.getByLabelText("Proposed Markdown · editable"), {
      target: {
        value:
          "# My edited note\n\nPreserved [source](https://youtube.com/watch?v=test&t=12)",
      },
    });
    fireEvent.click(first.getByLabelText("Accept change"));
    fireEvent.click(second.getByLabelText("Reject change"));
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Apply selected decisions" }),
    );
    await waitFor(() => expect(reviewed).toHaveBeenCalledOnce());
    expect(fetcher.mock.calls[0][0]).toBe(
      "/api/kb/proposals/proposal%3Atest/review",
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      decisions: [
        {
          changeId: "change:one",
          action: "accept",
          markdown:
            "# My edited note\n\nPreserved [source](https://youtube.com/watch?v=test&t=12)",
        },
        { changeId: "change:two", action: "reject" },
      ],
    });
  });
  it("retains edits and decisions when the companion reports a stale proposal", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          {
            error:
              "Knowledge changed since proposal generation. Review the current version.",
          },
          { status: 409 },
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    const reviewed = vi.fn();
    render(<ProposalReview proposal={proposal} onReviewed={reviewed} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Apply selected decisions" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Knowledge changed",
    );
    expect(reviewed).not.toHaveBeenCalled();
    expect(
      screen
        .getAllByRole("radio", { name: "Accept change" })
        .every((radio) => (radio as HTMLInputElement).checked),
    ).toBe(true);
  });
  it("rejects a no-change proposal without any knowledge changes", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          ...proposal,
          outcome: "no_change",
          changes: [],
          status: "rejected",
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    render(
      <ProposalReview
        proposal={{ ...proposal, outcome: "no_change", changes: [] }}
        onReviewed={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reject proposal" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      decisions: [],
      rejectNoChange: true,
    });
  });
  it("saves an explicit raw Markdown edit with the note identity", async () => {
    const note = {
      id: "knowledge:one",
      title: "My note",
      markdown: "Old content",
      path: "knowledge/one.md",
      createdAt: "2026-09-16T00:00:00Z",
      updatedAt: "2026-09-16T00:00:00Z",
      tags: [],
    };
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ ...note, markdown: "New content" }));
    vi.stubGlobal("fetch", fetcher);
    render(<NoteEditor note={note} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Markdown" }));
    fireEvent.change(screen.getByLabelText("Markdown"), {
      target: { value: "New content" },
    });
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Note saved"),
    );
    expect(fetcher.mock.calls[0][0]).toBe("/api/kb/knowledge/knowledge%3Aone");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      markdown: "New content",
      title: "My note",
    });
  });
  it("renders untrusted Markdown without executable HTML or JavaScript links", () => {
    const { container } = render(
      <Markdown
        text={
          "<img src=x onerror=alert(1)>\n\n[Bad](javascript:alert(1))\n\n[Source](https://example.com)"
        }
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("link", { name: "Bad" })).toBeNull();
    expect(screen.getByRole("link", { name: "Source" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });
});
