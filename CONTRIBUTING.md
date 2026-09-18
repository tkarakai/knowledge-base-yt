# Contributing

Use a feature branch and a pull request targeting `main` for every change, including documentation and dependency updates. Do not commit or push directly to `main`.

```sh
git fetch origin
git switch -c feat/my-change origin/main
# Make and commit changes.
git push -u origin HEAD
gh pr create --base main
```

Describe the problem, behavior changes, validation, and any setup steps in the PR. Draft PRs are welcome; CI runs on drafts too. Review outstanding conversations, update the branch if `main` changes, and wait for **Commonplace validation** before squash- or rebase-merging. Merge commits are disabled. Auto-merge is available but must be enabled for each PR deliberately. Delete merged feature branches manually when no longer needed. Agents must obtain user authorization before merging or enabling auto-merge.

The workflow follows `lifeor2-client`: zero general approvals, with code-owner review enabled in the ruleset. There is no `CODEOWNERS` file yet, so this does not currently request ownership-based reviews. PR authors cannot approve their own PRs. Existing approvals are not dismissed on new pushes, and unresolved conversations do not block merges. Review them before merging anyway. The ruleset requests Copilot review for new non-draft PRs, without re-review on every push; execution depends on Copilot availability.

## Validation

`.github/workflows/ci-kb.yml` runs on every PR to `main`, pushes to `main`, and manual dispatches. Its stable required check name is **Commonplace validation**. It runs:

- Development-process isolation tests.
- KB and web lint, type checking, unit and component tests.
- Retained Convex backend regression tests and the production web build.
- The KB browser journey with scale budgets, the real browser-extension journey, and storage/API performance checks.

Tests use temporary vaults and fixture YouTube/model providers; no Google account, production credentials, local vault, or running Convex deployment is needed. Live inference quality and authenticated caption retrieval remain separate operator checks. See [transcripts and diagnostics](docs/implementation/transcripts-and-traces.md).

The inherited Security workflow runs as additional checks. The six inherited app/shared CI workflows and the standalone KB performance workflow are manual-only; Commonplace validation covers the active product. Reusable starter workflows remain callable. All deployment workflows are manual-only and must be adapted to this validation check and configured with deployment credentials before use. Merging a PR does not automatically deploy.

Run the commands in `.github/workflows/ci-kb.yml` locally for equivalent validation. Individual commands and setup instructions are in [README.md](README.md).

## Main protection

This repository is public. Its configuration follows `lifeor2-client`, with **Commonplace validation** replacing the LifeOR2 check:

- `.github/repository-settings.json`: squash/rebase merges, auto-merge availability, manual branch deletion, and squash commit defaults.
- `.github/main-protection.json`: classic `main` branch protection with an up-to-date branch and required validation.
- `.github/main-ruleset.json`: default-branch protection, linear history, PR/code-owner review, Copilot review, and the required check bound to GitHub Actions.

For normal contributors, these rules require a PR, an up-to-date branch, passing validation, and linear history, and block force pushes and branch deletion. Administrators can bypass the rules, as in `lifeor2-client`; normal work must still follow the PR flow.

To apply the classic protection and repository settings:

```sh
gh api --method PUT repos/tkarakai/knowledge-base-yt/branches/main/protection \
  --input .github/main-protection.json
gh api --method PATCH repos/tkarakai/knowledge-base-yt \
  --input .github/repository-settings.json
gh api repos/tkarakai/knowledge-base-yt/rulesets
```

For the ruleset, use `POST repos/tkarakai/knowledge-base-yt/rulesets` with `--input .github/main-ruleset.json` on first setup. On subsequent updates, use `PUT repos/tkarakai/knowledge-base-yt/rulesets/<id>` with the ID returned by the listing above; do not create duplicate rulesets.
