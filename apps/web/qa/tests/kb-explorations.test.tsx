import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link, {
  WorkspaceBase,
  workspaceHref,
} from "../../src/components/kb/navigation";
import { ExplorationGallery } from "../../src/components/kb/explorations/gallery";
import { SourceQueue } from "../../src/components/kb/explorations/source-queue";
import { LibraryHome } from "../../src/components/kb/explorations/library-home";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("Experience navigation", () => {
  it("preserves encoded source IDs and timestamp anchors across every direction", () => {
    for (const concept of ["workbench", "pipeline", "library"]) {
      const base = `/kb/explore/${concept}`;
      expect(workspaceHref("/kb/sources/youtube%3Atest#t-24", base)).toBe(
        `${base}/sources/youtube%3Atest#t-24`,
      );
      expect(workspaceHref("/kb", base)).toBe(`${base}/inbox`);
      expect(workspaceHref("/kb/settings#youtube-history", base)).toBe(
        `${base}/settings#youtube-history`,
      );
      expect(workspaceHref("/kb/explore", base)).toBe("/kb/explore");
      expect(workspaceHref("https://youtube.com/watch?v=test", base)).toBe(
        "https://youtube.com/watch?v=test",
      );
      expect(workspaceHref("/kb-other", base)).toBe("/kb-other");
    }
    expect(workspaceHref("/kb/knowledge/note", null)).toBe(
      "/kb/knowledge/note",
    );
  });
  it("uses real link destinations within an experience", () => {
    render(
      <WorkspaceBase.Provider value="/kb/explore/library">
        <Link href="/kb/knowledge/note">Read note</Link>
      </WorkspaceBase.Provider>,
    );
    expect(screen.getByRole("link", { name: "Read note" })).toHaveAttribute(
      "href",
      "/kb/explore/library/knowledge/note",
    );
  });
  it("remembers a favorite without changing the default app", () => {
    const { unmount } = render(<ExplorationGallery />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Mark favorite" })[1],
    );
    expect(window.localStorage.getItem("commonplace-ux-favorite")).toBe(
      "pipeline",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "original experience remains your default",
    );
    unmount();
    render(<ExplorationGallery />);
    expect(
      screen.getByRole("button", { name: "Your favorite" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Exploration data states", () => {
  it("shows recoverable queue failures, without presenting stale rows as results", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "Companion offline" }, { status: 503 }),
      )
      .mockResolvedValue(
        Response.json({
          groups: [],
          total: 0,
          page: 1,
          pages: 1,
          pageSize: 50,
          counts: { inbox: 0, later: 0, all: 0 },
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    render(<SourceQueue />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Companion offline",
    );
    expect(screen.queryByText("You’re up to date")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("You’re up to date")).toBeInTheDocument();
  });
  it("filters the library by real tags and content and sorts titles", async () => {
    const notes = [
      {
        id: "knowledge:b",
        title: "Systems",
        markdown: "Feedback changes learning",
        tags: ["systems"],
        updatedAt: "2026-09-17",
        createdAt: "2026-09-16",
        path: "knowledge/b.md",
      },
      {
        id: "knowledge:a",
        title: "Attention",
        markdown: "Focus is a practice",
        tags: ["learning"],
        updatedAt: "2026-09-16",
        createdAt: "2026-09-16",
        path: "knowledge/a.md",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) =>
        Promise.resolve(
          Response.json(
            path.endsWith("/knowledge") ? notes : { groups: [], total: 0 },
          ),
        ),
      ),
    );
    render(
      <WorkspaceBase.Provider value="/kb/explore/library">
        <LibraryHome />
      </WorkspaceBase.Provider>,
    );
    await screen.findByRole("link", { name: /Systems/ });
    fireEvent.click(screen.getByRole("button", { name: /learning/ }));
    expect(
      screen.queryByRole("link", { name: /Systems/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /All notes/ }));
    fireEvent.change(screen.getByLabelText("Sort library notes"), {
      target: { value: "title" },
    });
    expect(
      screen
        .getAllByRole("link")
        .filter((e) => e.classList.contains("ux-library-card"))[0],
    ).toHaveTextContent("Attention");
    fireEvent.change(screen.getByLabelText("Search library notes"), {
      target: { value: "Feedback" },
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: /Attention/ }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /Systems/ })).toHaveAttribute(
      "href",
      "/kb/explore/library/knowledge/knowledge%3Ab",
    );
  });
});
