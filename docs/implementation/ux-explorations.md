# Experience lab

Open **Experience lab** in the original sidebar, or visit `/kb/explore`. The original `/kb` experience remains available and remains the default. The lab offers three working approaches to the same vault; changes are real and shared across every experience. There is no sample data or second vault in the product.

| Direction | Entry point | Organizing principle | Best suited to | Tradeoff |
| --- | --- | --- | --- | --- |
| Workbench | `/kb/explore/workbench` | Compact overview and source queue; queue, source, and reflection share the desktop workspace | Processing sources and writing reflections | More simultaneous information; reading and reflection stack at narrower widths |
| Pipeline | `/kb/explore/pipeline` | Capture → reflect and connect → review → knowledge | Understanding the workflow and establishing a learning routine | Less emphasis on browsing finished knowledge |
| Library | `/kb/explore/library` | Topic shelves, note search, reading/editing, and supporting source material | Rediscovery and research | Capture is secondary; topic shelves depend on tags already present in note frontmatter |

The selector in the top bar changes direction while retaining the current resource and evidence timestamp. **Compare experiences** returns to the lab; **Original app** returns to the existing inbox. A favorite is stored in this browser only; choosing one does not change the app default. Save edits before navigating away, as in the original editors.

## What changed in the UX

The original screen arrangement hides the relationship between capture, reflection, synthesis, review, and knowledge. Large page introductions, wide margins, and decorative footers reduce the space for actual work. The alternatives use explicit destinations and next actions, consistent placement of search and settings, compact content headers, and visible workflow context.

The directions share the underlying capture, transcript import/retry, reflection, evidence selection, synthesis, editable proposal review, note editing, document import, vault search, activity, and settings functionality. They deliberately reuse the existing mutation and review contracts. New contextual links retain the direction after a save, synthesis, search result, or evidence click. There is no automatic acceptance and no new model behavior.

- **Workbench:** live counts link to their work queues; the source list has full-catalog title/channel filtering and server pagination. At desktop widths, queue pagination remains visible while the rows scroll. A selected source has a persistent neighboring queue. Background refreshes keep existing rows visible.
- **Pipeline:** columns show bounded previews and actual totals. Open a stage to see its complete queue. Cards are links, not drag handles: moving knowledge forward involves reflection and explicit review. Deferred and ignored sources remain reachable through inbox filters.
- **Library:** note title/body search, tag shelves, title/recent sorting, contextual reading and editing, direct Markdown import, and source suggestions. Whole-vault search stays available for transcripts and documents. New libraries explain how accepted knowledge is created and show existing source material.

The work follows [Nielsen Norman Group’s usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): visible state, recognition rather than recall, consistent destinations, and user control. Responsive layouts and keyboard controls are informed by [WCAG 2.2](https://www.w3.org/TR/WCAG22/), including [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). Automated checks are evidence, not a claim of complete accessibility conformance or a substitute for user evaluation.

## A useful comparison

In each direction, try opening a source, selecting a passage, writing a Keep reflection, proposing connections, reviewing changes, and finding/editing the resulting note. Configure a model in Settings if needed. Ask:

1. Can I tell where I am and what I can do next?
2. Can I find a source or note without remembering where it lives?
3. Is the amount of information comfortable at my usual window size?
4. Can I move from evidence to reflection to review without losing context?

It is reasonable to combine a preferred navigation model with another direction’s reader or density after comparing them.

## Implementation and validation

New components live in `apps/web/src/components/kb/explorations/`; styles are scoped in `apps/web/src/app/kb/explorations.css`. `WorkspaceBase` maps existing `/kb` links and imperative source navigation to the current experience. Without a provider, link behavior is unchanged. The source-page endpoint adds the `kept` filter for kept and actively synthesizing sources, applied before search and pagination; the original filters and counts retain their contracts.

The browser journey in `apps/web/qa/e2e/kb-ux-journey.ts` is invoked by the existing `bun run test:kb:e2e` and CI performance journey. It uses the same disposable vault, fixture YouTube/model servers, real companion, Next proxy, and Pi adapter. It exercises all three complete workflows, experience switching, persisted favorites, mobile routes, and axe checks on the new overview screens. Component tests cover link scoping, favorites, retry behavior, and library filtering. Companion tests cover the new queue beyond the first page.

To validate without interfering with a running dev workspace, use a separate build directory under the already-ignored `.next` tree:

```sh
KB_NEXT_DIST_DIR=.next/ux-validation bun run build:kb
KB_NEXT_DIST_DIR=.next/ux-validation KB_E2E_PRODUCTION=1 bun run test:kb:perf:browser
```

Screenshots and performance reports are written to `.kb-local/qa` and `.kb-local/performance`. Do not commit screenshots of a personal vault. Live model quality, personal data, and real authenticated history import remain separate operator checks.
