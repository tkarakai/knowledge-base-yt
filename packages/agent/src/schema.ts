import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import type {
  AgentContext,
  AgentTools,
  SynthesisProposal,
} from "@repo/kb-shared";

const text = (maxLength = 4000) => Type.String({ maxLength });
const evidence = Type.Object(
  {
    sourceId: Type.String({ pattern: "^youtube:[A-Za-z0-9_-]{11}$" }),
    start: Type.Optional(Type.Number({ minimum: 0 })),
    end: Type.Optional(Type.Number({ minimum: 0 })),
    quote: Type.Optional(text(12000)),
  },
  { additionalProperties: false },
);
export const submissionSchema = Type.Object(
  {
    summary: text(),
    whyItMatters: text(),
    outcome: Type.Union([Type.Literal("changes"), Type.Literal("no_change")]),
    changes: Type.Array(
      Type.Object(
        {
          operation: Type.Union([
            Type.Literal("create_note"),
            Type.Literal("patch_note"),
          ]),
          knowledgeId: Type.String({
            pattern: "^knowledge:[A-Za-z0-9][A-Za-z0-9_-]{0,119}$",
          }),
          title: Type.String({ minLength: 1, maxLength: 300 }),
          before: text(100000),
          after: Type.String({ minLength: 1, maxLength: 100000 }),
          rationale: Type.String({ minLength: 1, maxLength: 4000 }),
          evidence: Type.Array(evidence, { minItems: 1, maxItems: 20 }),
        },
        { additionalProperties: false },
      ),
      { maxItems: 12 },
    ),
    questions: Type.Array(text(2000), { maxItems: 20 }),
  },
  { additionalProperties: false },
);
export type Submission = Static<typeof submissionSchema>;

export async function validateSubmission(
  input: unknown,
  context: AgentContext,
  tools: AgentTools,
  model: string,
): Promise<SynthesisProposal> {
  if (!Value.Check(submissionSchema, input))
    throw new Error("Invalid synthesis proposal schema");
  const data = input as Submission;
  if ((data.outcome === "no_change") !== (data.changes.length === 0))
    throw new Error("Proposal outcome does not match changes");
  const ids = new Set<string>();
  for (const change of data.changes) {
    if (ids.has(change.knowledgeId))
      throw new Error("Multiple changes target the same knowledge ID");
    ids.add(change.knowledgeId);
    const existing = await tools.read(change.knowledgeId);
    if (
      change.operation === "create_note" &&
      (existing || change.before !== "")
    )
      throw new Error("New note already exists or contains prior text");
    if (
      change.operation === "patch_note" &&
      (!existing || change.before !== existing.markdown)
    )
      throw new Error("Proposed patch does not match the current note");
    if (change.before === change.after)
      throw new Error("Proposed change is empty");
    // The app adds trusted frontmatter, not the model.
    if (/^\s*---(?:\r?\n|$)/.test(change.after))
      throw new Error(
        "Proposed text must be a Markdown body without frontmatter",
      );
    for (const ref of change.evidence) {
      if (ref.sourceId !== context.source.id)
        throw new Error("Evidence refers to an unavailable source");
      if ((ref.start === undefined) !== (ref.end === undefined))
        throw new Error("Evidence requires both start and end timestamps");
      if (ref.start !== undefined && ref.end !== undefined) {
        if (ref.end < ref.start)
          throw new Error("Evidence timestamp range is invalid");
        const segments =
          context.transcript?.segments.filter((s) =>
            ref.start === ref.end
              ? s.start <= ref.start! && s.end >= ref.end!
              : s.start < ref.end! && s.end > ref.start!,
          ) ?? [];
        if (
          !segments.length ||
          ref.start < segments[0]!.start ||
          ref.end > segments[segments.length - 1]!.end
        )
          throw new Error("Evidence timestamp is outside the transcript");
        if (
          ref.quote &&
          !segments
            .map((s) => s.text)
            .join(" ")
            .includes(ref.quote)
        )
          throw new Error("Evidence quote is absent from the transcript range");
      } else if (
        ref.quote &&
        !context.transcript?.segments
          .map((s) => s.text)
          .join(" ")
          .includes(ref.quote)
      ) {
        throw new Error("Evidence quote is absent from the transcript");
      }
    }
  }
  return {
    id: `proposal:${crypto.randomUUID()}`,
    sourceId: context.source.id,
    createdAt: new Date().toISOString(),
    model,
    summary: data.summary,
    whyItMatters: data.whyItMatters,
    outcome: data.outcome,
    changes: data.changes.map((change) => ({
      ...change,
      id: `change:${crypto.randomUUID()}`,
      decision: "pending",
    })),
    questions: data.questions,
    status: "pending",
  };
}
