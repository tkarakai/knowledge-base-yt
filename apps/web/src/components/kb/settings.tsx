"use client";

import { useState } from "react";
import { PerformanceSettings } from "./performance-settings";
import { HistoryConnectionSettings } from "./history-connection";
import { JobTrace } from "./job-trace";
import {
  Check,
  Database,
  FolderOpen,
  GitBranch,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import type { AppSettings, Health, Job, ModelConfig } from "@repo/kb-shared";
import {
  api,
  useResource,
  useAction,
  Feedback,
  LoadState,
  PageTitle,
  Badge,
  date,
} from "./common";

export function SettingsView({ onSaved }: { onSaved: () => void }) {
  const settings = useResource<AppSettings>("settings");
  const health = useResource<Health>("health");
  const jobs = useResource<Job[]>("jobs");
  const action = useAction();
  return (
    <>
      <PageTitle
        eyebrow="THE WORKSPACE / UNDER YOUR CONTROL"
        title="A home for your knowledge"
        description="Local files, your choice of models, and deliberate connections to the outside world."
      />
      <div className="kb-settings-status">
        <div>
          <Server size={20} />
          <span>
            <strong>
              {health.data?.ok && !health.error
                ? "Companion connected"
                : health.loading
                  ? "Checking your companion…"
                  : "Companion unavailable"}
            </strong>
            <span>
              {health.data?.version
                ? `Version ${health.data.version}`
                : "The workspace talks to your local companion."}
            </span>
          </span>
        </div>
        <button
          className="kb-button kb-small"
          onClick={() => {
            health.reload();
            settings.reload();
            jobs.reload();
          }}
        >
          <RefreshCw size={14} />
          Check connection
        </button>
      </div>
      <Feedback error={health.error} />
      <LoadState {...settings} retry={settings.reload} />
      {settings.data && !settings.error && (
        <SettingsForm
          initial={settings.data}
          onSaved={() => {
            onSaved();
            health.reload();
          }}
        />
      )}
      <HistoryConnectionSettings />
      <PerformanceSettings />
      <section className="kb-settings-section">
        <div className="kb-settings-description">
          <Database size={22} strokeWidth={1.4} />
          <h2>The derived index</h2>
          <p>
            Your Markdown is the source of truth. The search index can always be
            rebuilt from the vault.
          </p>
        </div>
        <div>
          <Feedback {...action} />
          <p className="kb-help">
            Rebuild after changing files outside the app. Embeddings use the
            configured model when enabled.
          </p>
          <button
            className="kb-button"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                const result = await api<{ chunks: number }>(
                  "index/rebuild",
                  "POST",
                  {},
                );
                jobs.reload();
                throwIfInvalid(result);
              }, "Search index rebuilt from your Markdown vault.")
            }
          >
            <RefreshCw size={15} />
            {action.busy ? "Rebuilding…" : "Rebuild search index"}
          </button>
        </div>
      </section>
      <section className="kb-settings-section">
        <div className="kb-settings-description">
          <Settings2 size={22} strokeWidth={1.4} />
          <h2>Recent activity</h2>
          <p>Background work and actionable failures from the companion.</p>
        </div>
        <div>
          <LoadState {...jobs} retry={jobs.reload} />
          {jobs.data &&
            !jobs.error &&
            (jobs.data.length ? (
              <div className="kb-jobs">
                {[...jobs.data]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 12)
                  .map((job) => (
                    <div key={job.id}>
                      <div>
                        <strong>{job.type.replaceAll("_", " ")}</strong>
                        <Badge value={job.state} />
                      </div>
                      <span className="kb-help">
                        {date(job.updatedAt)}
                        {job.sourceId && ` · ${job.sourceId}`}
                      </span>
                      {job.error && <p className="kb-job-error">{job.error}</p>}
                      <JobTrace job={job} />
                    </div>
                  ))}
              </div>
            ) : (
              <p className="kb-help">No background activity yet.</p>
            ))}
        </div>
      </section>
    </>
  );
}

function throwIfInvalid(result: { chunks: number }) {
  if (typeof result.chunks !== "number")
    throw new Error(
      "Rebuild completed without a valid index count. Check the companion logs.",
    );
}

function SettingsForm({
  initial,
  onSaved,
}: {
  initial: AppSettings;
  onSaved: () => void;
}) {
  const [inference, setInference] = useState<ModelConfig>({
    ...initial.inference,
    apiKey: "",
  });
  const [embeddings, setEmbeddings] = useState<ModelConfig>({
    ...initial.embeddings,
    apiKey: "",
  });
  const [network, setNetwork] = useState(initial.network);
  const [gitAutoCommit, setGitAutoCommit] = useState(initial.gitAutoCommit);
  const action = useAction();
  return (
    <form
      className="kb-settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        void action.run(async () => {
          const saved = await api<AppSettings>("settings", "PUT", {
            inference: {
              ...inference,
              contextWindow: inference.contextWindow ?? null,
            },
            embeddings,
            network,
            gitAutoCommit,
          });
          setInference({ ...saved.inference, apiKey: "" });
          setEmbeddings({ ...saved.embeddings, apiKey: "" });
          setNetwork(saved.network);
          setGitAutoCommit(saved.gitAutoCommit);
          onSaved();
        }, "Workspace settings saved.");
      }}
    >
      <section className="kb-settings-section">
        <div className="kb-settings-description">
          <FolderOpen size={22} strokeWidth={1.4} />
          <h2>Your Markdown vault</h2>
          <p>
            Ordinary files. Durable knowledge. Available beyond this workspace.
          </p>
        </div>
        <div>
          <label htmlFor="kb-vault">Vault location</label>
          <input id="kb-vault" readOnly value={initial.vaultPath} />
          <p className="kb-help">
            The vault location is configured with KB_VAULT_PATH when starting
            the companion.
          </p>
        </div>
      </section>
      <section className="kb-settings-section">
        <div className="kb-settings-description">
          <Server size={22} strokeWidth={1.4} />
          <h2>Reasoning model</h2>
          <p>
            An OpenAI-compatible endpoint for synthesis. Local inference is a
            first-class option.
          </p>
        </div>
        <ModelFields
          name="inference"
          value={inference}
          onChange={setInference}
        />
      </section>
      <section className="kb-settings-section">
        <div className="kb-settings-description">
          <Database size={22} strokeWidth={1.4} />
          <h2>Embedding model</h2>
          <p>
            Add semantic retrieval to your local text index. Without it, lexical
            search stays available.
          </p>
        </div>
        <ModelFields
          name="embeddings"
          value={embeddings}
          onChange={setEmbeddings}
        />
      </section>
      <section className="kb-settings-section">
        <div className="kb-settings-description">
          <ShieldCheck size={22} strokeWidth={1.4} />
          <h2>Network permissions</h2>
          <p>
            Decide which services this workspace can contact. Model endpoints
            can be local or remote.
          </p>
        </div>
        <div className="kb-toggles">
          {(
            [
              {
                key: "youtube",
                title: "YouTube metadata & captions",
                description:
                  "Retrieve source details and available transcripts.",
              },
              {
                key: "inference",
                title: "Reasoning endpoint",
                description:
                  "Send source context and related notes to the configured model.",
              },
              {
                key: "embeddings",
                title: "Embedding endpoint",
                description:
                  "Send text chunks to the configured embedding model.",
              },
            ] as const
          ).map(({ key, title, description }) => (
            <label key={key}>
              <span>
                <strong>{title}</strong>
                <span>{description}</span>
              </span>
              <input
                type="checkbox"
                checked={network[key]}
                onChange={(event) =>
                  setNetwork((value) => ({
                    ...value,
                    [key]: event.target.checked,
                  }))
                }
              />
            </label>
          ))}
        </div>
      </section>
      <section className="kb-settings-section">
        <div className="kb-settings-description">
          <GitBranch size={22} strokeWidth={1.4} />
          <h2>A history in Git</h2>
          <p>
            Keep local commits of accepted knowledge changes when the vault is a
            Git repository.
          </p>
        </div>
        <div className="kb-toggles">
          <label>
            <span>
              <strong>Commit accepted changes</strong>
              <span>
                Create a local commit after approval. Nothing is pushed.
              </span>
            </span>
            <input
              type="checkbox"
              checked={gitAutoCommit}
              onChange={(event) => setGitAutoCommit(event.target.checked)}
            />
          </label>
        </div>
      </section>
      <div className="kb-settings-save">
        <Feedback {...action} />
        <button className="kb-button kb-primary" disabled={action.busy}>
          <Check size={16} />
          {action.busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}

function ModelFields({
  name,
  value,
  onChange,
}: {
  name: "inference" | "embeddings";
  value: ModelConfig;
  onChange: (value: ModelConfig) => void;
}) {
  const connection = useAction();
  const [checkedValues, setCheckedValues] = useState<string | null>(null);
  const currentValues = JSON.stringify(value);
  const modelLabel = name === "inference" ? "reasoning" : "embedding";
  return (
    <div className="kb-model-fields">
      <label htmlFor={`kb-${name}-url`}>Base URL</label>
      <input
        id={`kb-${name}-url`}
        type="url"
        value={value.baseUrl}
        placeholder="http://127.0.0.1:1234/v1"
        onChange={(event) =>
          onChange({ ...value, baseUrl: event.target.value })
        }
      />
      <label htmlFor={`kb-${name}-model`}>Model name</label>
      <input
        id={`kb-${name}-model`}
        value={value.model}
        placeholder={
          name === "inference"
            ? "Your local reasoning model"
            : "Your embedding model"
        }
        onChange={(event) => onChange({ ...value, model: event.target.value })}
      />
      <label htmlFor={`kb-${name}-key`}>
        API key <span>optional</span>
      </label>
      <input
        id={`kb-${name}-key`}
        type="password"
        autoComplete="new-password"
        value={value.apiKey ?? ""}
        placeholder={
          value.apiKeyConfigured
            ? "••••••••••••"
            : "Enter an API key if required"
        }
        aria-describedby={`kb-${name}-key-status`}
        onChange={(event) => onChange({ ...value, apiKey: event.target.value })}
      />
      <p className="kb-help" id={`kb-${name}-key-status`} role="status">
        {value.apiKeyConfigured
          ? "API key saved. It stays hidden after reload. Leave this field blank to keep it, or enter a replacement and save settings."
          : "No API key saved. If your endpoint requires one, enter it and save settings."}
      </p>
      {name === "inference" && (
        <>
          <label htmlFor="kb-context-window">
            Context window <span>tokens, optional</span>
          </label>
          <input
            id="kb-context-window"
            type="number"
            min={4096}
            max={2_000_000}
            step={1}
            value={value.contextWindow ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                contextWindow: event.target.value
                  ? Number(event.target.value)
                  : undefined,
              })
            }
          />
          <p className="kb-help">
            Match the context window configured on your model server. Traces
            show estimated request size and reported token usage.
          </p>
          <label htmlFor="kb-output-tokens">Maximum output tokens</label>
          <input
            id="kb-output-tokens"
            type="number"
            min={256}
            max={32768}
            step={1}
            value={value.maxOutputTokens ?? 8192}
            onChange={(event) =>
              onChange({
                ...value,
                maxOutputTokens: Number(event.target.value),
              })
            }
          />
          <p className="kb-help">
            Also capped at one third of the context window to leave room for
            input.
          </p>
          <label htmlFor="kb-timeout-seconds">
            Synthesis time budget (seconds)
          </label>
          <input
            id="kb-timeout-seconds"
            type="number"
            min={10}
            max={600}
            step={1}
            value={value.timeoutSeconds ?? 120}
            onChange={(event) =>
              onChange({ ...value, timeoutSeconds: Number(event.target.value) })
            }
          />
          <p className="kb-help">
            Covers all model turns in a run. A successful connection check tests
            a short reply; synthesis additionally requires tool calling and a
            valid proposal.
          </p>
        </>
      )}
      <div className="kb-model-connection">
        <button
          type="button"
          className="kb-button kb-small"
          aria-label={`Check ${modelLabel} model connection`}
          disabled={
            connection.busy || !value.baseUrl.trim() || !value.model.trim()
          }
          onClick={() => {
            setCheckedValues(currentValues);
            void connection.run(
              async () => {
                await api(`settings/${name}/check`, "POST", {
                  baseUrl: value.baseUrl,
                  model: value.model,
                  apiKey: value.apiKey ?? "",
                });
              },
              `${name === "inference" ? "Reasoning" : "Embedding"} model connected. A test ${name === "inference" ? "reply" : "embedding"} was received.`,
            );
          }}
        >
          <RefreshCw
            size={14}
            className={connection.busy ? "kb-spin" : undefined}
          />
          {connection.busy ? "Checking…" : "Check connection"}
        </button>
        <p className="kb-help">
          Sends a short test using these fields and your saved key if left
          blank. Changes are saved only with Save settings.
        </p>
        {checkedValues === currentValues && <Feedback {...connection} />}
      </div>
    </div>
  );
}
