#!/usr/bin/env bash
#
# Run GitHub Actions CI workflows locally using act.
#
# Usage: ./scripts/ci-local-act.sh [options]
#
# Options:
#   -j, --job <name>     Run only a specific job (e.g., lint, test, build)
#   -w, --workflow <id>   Run only a specific workflow (shared, web, admin, landing)
#   -q, --quiet          Suppress step output, show only job status
#   -o, --offline        Offline mode (skip image pulls, use cached actions)
#   -l, --list           List available jobs across all workflows
#   -h, --help           Show this help
#
# Examples:
#   ./scripts/ci-local-act.sh              # Run all CI workflows
#   ./scripts/ci-local-act.sh -w shared    # Run only shared (lint + backend tests)
#   ./scripts/ci-local-act.sh -w web       # Run only web app CI
#   ./scripts/ci-local-act.sh -j lint      # Run only the lint job
#   ./scripts/ci-local-act.sh -q           # Quiet mode with summary
#   ./scripts/ci-local-act.sh -o           # Offline mode (requires prior online run)
#
# =============================================================================
# MULTI-WORKFLOW ARCHITECTURE
# =============================================================================
# CI is split into 5 independent workflows:
#   - ci-shared.yml:    Lint, typecheck, backend tests (run once across all packages)
#   - ci-web.yml:       Web app tests, build, E2E
#   - ci-admin.yml:     Admin app tests, build, E2E
#   - ci-landing.yml:   Landing app tests, build, E2E
#   - ci-storybook.yml: Storybook app build, E2E
#
# Each workflow uses composite actions (.github/actions/setup-bun,
# .github/actions/setup-playwright) for shared setup steps.
#
# This script runs each workflow sequentially and aggregates results.
# =============================================================================
#
# OFFLINE MODE
# =============================================================================
# Docker volumes persist tool installations between runs:
#   - Bun binary and package cache (act-bun-cache -> /root/.bun)
#   - Playwright browser binaries (act-playwright-cache -> /root/.cache/ms-playwright)
#   - Node.js installations (act-toolcache -> /opt/act-toolcache)
#
# First run (online): Downloads and installs all tools to Docker volumes
# Subsequent runs: Uses cached tools from volumes (works offline)
#
# See CLAUDE.md "Offline CI Mode (act)" for full documentation.
# =============================================================================
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/.act-output.log"
ARTIFACTS_DIR="$PROJECT_DIR/.act-artifacts"

# CI workflow files (in execution order)
CI_WORKFLOWS=(
    ".github/workflows/ci-shared.yml"
    ".github/workflows/ci-web.yml"
    ".github/workflows/ci-admin.yml"
    ".github/workflows/ci-landing.yml"
    ".github/workflows/ci-storybook.yml"
)

# Friendly names for display (parallel arrays)
CI_WORKFLOW_NAMES=(
    "CI Shared"
    "CI Web"
    "CI Admin"
    "CI Landing"
    "CI Storybook"
)

# Short IDs for --workflow flag
CI_WORKFLOW_IDS=(
    "shared"
    "web"
    "admin"
    "landing"
    "storybook"
)

# Table width settings
TABLE_WIDTH=62

# Parse arguments
QUIET=false
JOB=""
WORKFLOW_FILTER=""
LIST=false
OFFLINE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -j|--job)
            JOB="$2"
            shift 2
            ;;
        -w|--workflow)
            WORKFLOW_FILTER="$2"
            shift 2
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -o|--offline)
            OFFLINE=true
            shift
            ;;
        -l|--list)
            LIST=true
            shift
            ;;
        -h|--help)
            head -24 "$0" | tail -22 | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

cd "$PROJECT_DIR"

# Resolve which workflows to run based on --workflow flag
get_active_workflows() {
    if [ -n "$WORKFLOW_FILTER" ]; then
        local found=false
        for i in "${!CI_WORKFLOW_IDS[@]}"; do
            if [ "${CI_WORKFLOW_IDS[$i]}" = "$WORKFLOW_FILTER" ]; then
                echo "$i"
                found=true
                break
            fi
        done
        if [ "$found" = false ]; then
            echo -e "${RED}Unknown workflow: $WORKFLOW_FILTER${NC}" >&2
            echo -e "Available: ${CI_WORKFLOW_IDS[*]}" >&2
            exit 1
        fi
    else
        for i in "${!CI_WORKFLOWS[@]}"; do
            echo "$i"
        done
    fi
}

# List jobs if requested
if [ "$LIST" = true ]; then
    echo -e "${BLUE}Available CI jobs:${NC}"
    echo ""
    for i in $(get_active_workflows); do
        wf="${CI_WORKFLOWS[$i]}"
        wf_name="${CI_WORKFLOW_NAMES[$i]}"
        echo -e "  ${BOLD}$wf_name${NC} ($wf)"
        act pull_request -W "$wf" -l 2>/dev/null | tail -n +2 | while read -r line; do
            job=$(echo "$line" | awk '{print $2}')
            name=$(echo "$line" | awk '{$1=$2=""; print $0}' | sed 's/^ *//')
            echo -e "    ${CYAN}$job${NC} - $name"
        done
        echo ""
    done
    exit 0
fi

# Prepare artifacts directory (clear previous run)
rm -rf "$ARTIFACTS_DIR"
mkdir -p "$ARTIFACTS_DIR"
> "$LOG_FILE"

# Build base act args (shared across all workflow runs)
# Volume mounts for caching:
# - act-bun-cache: Package cache (node_modules)
# - act-playwright-cache: Playwright browser binaries
# - act-toolcache: Bun/Node installations (at custom path to avoid act's internal mount)
# - artifacts dir: Host directory to extract reports into, from containers
# Note: /opt/hostedtoolcache is managed by act internally, so we use /opt/act-toolcache instead
CACHE_VOLUMES="-v act-bun-cache:/root/.bun -v act-playwright-cache:/root/.cache/ms-playwright -v act-toolcache:/opt/act-toolcache -v $ARTIFACTS_DIR:/act-artifacts"
BASE_ACT_ARGS=(--container-options "$CACHE_VOLUMES")
BASE_ACT_ARGS+=(--env "RUNNER_TOOL_CACHE=/opt/act-toolcache")
if [ -n "$JOB" ]; then
    BASE_ACT_ARGS+=(-j "$JOB")
fi
if [ "$OFFLINE" = true ]; then
    BASE_ACT_ARGS+=(--pull=false --action-offline-mode)
fi

# Print header
echo ""
echo -e "${BLUE}┌──────────────────────────────────────────────────────────────┐${NC}"
echo -e "${BLUE}│${NC}              ${BOLD}Running GitHub Actions CI locally${NC}               ${BLUE}│${NC}"
echo -e "${BLUE}└──────────────────────────────────────────────────────────────┘${NC}"
echo ""

if [ -n "$WORKFLOW_FILTER" ]; then
    echo -e "${CYAN}Workflow:${NC} $WORKFLOW_FILTER"
fi
[ -n "$JOB" ] && echo -e "${CYAN}Job:${NC} $JOB"
echo ""

START_TIME=$(date +%s)

# Helper to print a table row with proper alignment
print_row() {
    local content="$1"
    local icon="$2"
    local max_content=$((TABLE_WIDTH - 6))  # 6 = 2 border + 2 space + 2 icon width
    if [ ${#content} -gt $max_content ]; then
        content="${content:0:$max_content}"
    fi
    local padding=$((max_content - ${#content}))
    # Add extra space for skip icon (⏭️) which renders narrower than ✅/❌
    local icon_pad=""
    [[ "$icon" == "⏭️" ]] && icon_pad=" "
    echo -e "${BLUE}│${NC} ${icon}${icon_pad} ${content}$(printf '%*s' "$padding" '') ${BLUE}│${NC}"
}

# ============================================================
# Run each workflow sequentially
# ============================================================
OVERALL_FAILED=false
ALL_JOB_RESULTS=""

for wf_idx in $(get_active_workflows); do
    workflow="${CI_WORKFLOWS[$wf_idx]}"
    wf_name="${CI_WORKFLOW_NAMES[$wf_idx]}"
    wf_id="${CI_WORKFLOW_IDS[$wf_idx]}"
    WF_LOG="$PROJECT_DIR/.act-wf-output.log"

    echo -e "${BLUE}▶${NC} ${BOLD}$wf_name${NC} ($workflow)"

    ACT_CMD="act pull_request -W $workflow ${BASE_ACT_ARGS[*]}"
    echo -e "${DIM}  $ACT_CMD${NC}"
    echo ""

    # Run act for this workflow (simulate pull_request event since all workflows trigger on it)
    if [ "$QUIET" = true ]; then
        act pull_request -W "$workflow" "${BASE_ACT_ARGS[@]}" 2>&1 | tee "$WF_LOG" | grep -E '(⭐ Run Main|✅  Success|❌  Failure|🏁  Job)' || true
    else
        act pull_request -W "$workflow" "${BASE_ACT_ARGS[@]}" 2>&1 | tee "$WF_LOG" || true
    fi

    # Append to combined log
    cat "$WF_LOG" >> "$LOG_FILE"

    # Build lookup of expected jobs for this workflow
    # act -l format: Stage  Job ID  Job name  Workflow name  Workflow file  Events
    EXPECTED_JOBS=""
    while IFS= read -r line; do
        stage=$(echo "$line" | awk '{print $1}')
        job_id=$(echo "$line" | awk '{print $2}')
        # Extract job name: fields 3+ until we hit the workflow filename column.
        # We anchor on the workflow filename (e.g. "ci-shared.yml") rather than the
        # workflow *name* because job names can start with the workflow name
        # (e.g. "CI Shared Complete" starts with "CI Shared").
        wf_file=$(basename "$workflow")
        job_name=$(echo "$line" | awk -v wff="$wf_file" '{
            name = ""
            for (i = 3; i <= NF; i++) {
                if ($i == wff) break
                name = (name == "" ? $i : name " " $i)
            }
            # Remove the trailing workflow name (last N words before the filename).
            # The workflow name word count = number of words in wff minus extension,
            # but we can just trim from the end: find the longest suffix that matches
            # by comparing against the known workflow name.
            print name
        }')
        # The job_name now includes the trailing workflow name — strip it
        job_name=$(echo "$job_name" | sed "s/ *${wf_name}$//")
        if [ -n "$job_id" ] && [ "$job_id" != "Job" ]; then
            EXPECTED_JOBS="$EXPECTED_JOBS
$stage|$job_id|$job_name"
        fi
    done < <(act pull_request -W "$workflow" -l 2>/dev/null | tail -n +2)

    # Helper to look up job_id from job_name for this workflow
    lookup_job_id() {
        local jn="$1"
        echo "$EXPECTED_JOBS" | awk -F'|' -v name="$jn" '$3 == name {print $2; exit}'
    }

    # Extract job results from this workflow's log
    # Log lines look like: "[CI Shared/Lint & Typecheck] 🏁  Job succeeded"
    SEEN_JOB_IDS=""
    while IFS= read -r line; do
        if [[ "$line" =~ "🏁  Job succeeded" ]] || [[ "$line" =~ "🏁  Job failed" ]] || \
           [[ "$line" =~ "was skipped" ]] || [[ "$line" =~ "Skipping job" ]] || [[ "$line" =~ "skipped due to" ]]; then
            # Extract job name from [Workflow Name/Job Name] prefix
            job_name=$(echo "$line" | sed "s/\[$wf_name\///" | sed 's/\].*//' | sed 's/^ *//' | sed 's/ *$//')
            [ -z "$job_name" ] && continue

            job_id=$(lookup_job_id "$job_name")
            [ -z "$job_id" ] && continue

            if [[ "$line" =~ "🏁  Job succeeded" ]]; then
                icon="✅"
            elif [[ "$line" =~ "🏁  Job failed" ]]; then
                icon="❌"
                OVERALL_FAILED=true
            else
                icon="⏭️"
            fi

            ALL_JOB_RESULTS="$ALL_JOB_RESULTS
$wf_name|$job_id|$job_name|$icon"
            SEEN_JOB_IDS="$SEEN_JOB_IDS|$job_id"
        fi
    done < "$WF_LOG"

    # Add expected but unseen jobs as skipped
    while IFS='|' read -r _stage job_id job_name; do
        [ -z "$job_id" ] && continue
        if [[ "$SEEN_JOB_IDS" != *"|$job_id"* ]]; then
            ALL_JOB_RESULTS="$ALL_JOB_RESULTS
$wf_name|$job_id|$job_name|⏭️"
        fi
    done <<< "$EXPECTED_JOBS"

    # Extract per-job logs from this workflow
    current_log_file=""
    seen_jobs=""

    while IFS= read -r line; do
        # Match lines prefixed with [Workflow Name/Job Name]
        if [[ "$line" =~ \[$wf_name/([^\]]+)\] ]]; then
            job_name=$(echo "${BASH_REMATCH[1]}" | sed 's/ *$//')
            if [ -n "$job_name" ]; then
                job_id=$(lookup_job_id "$job_name")
                [ -z "$job_id" ] && continue
                current_log_file="$ARTIFACTS_DIR/$wf_id/$job_id/console.log"

                if [[ "$seen_jobs" != *"|$job_id|"* ]]; then
                    mkdir -p "$(dirname "$current_log_file")"
                    > "$current_log_file"
                    seen_jobs="$seen_jobs|$job_id|"
                fi

                echo "$line" >> "$current_log_file"
            fi
        elif [ -n "$current_log_file" ]; then
            echo "$line" >> "$current_log_file"
        fi
    done < "$WF_LOG"

    rm -f "$WF_LOG"
    echo ""
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECS=$((DURATION % 60))

# Clean up combined log
rm -f "$LOG_FILE"

# ============================================================
# Record summary + artifacts to run log (and display to console)
# ============================================================
RUN_LOG="$ARTIFACTS_DIR/summary.log"

# Use a subshell + tee so everything from here to the end is both
# displayed on the console AND captured to the run log file.
{

# ============================================================
# Show Summary table
# ============================================================
echo ""
echo -e "${BLUE}┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${BLUE}│${NC}                          ${BOLD}Summary${NC}                            ${BLUE}│${NC}"
echo -e "${BLUE}├─────────────────────────────────────────────────────────────┤${NC}"

if [ -z "$ALL_JOB_RESULTS" ]; then
    print_row "No jobs completed" "⚠️"
else
    current_wf=""
    echo "$ALL_JOB_RESULTS" | while IFS= read -r result; do
        [ -z "$result" ] && continue
        wf=$(echo "$result" | cut -d'|' -f1)
        job_id=$(echo "$result" | cut -d'|' -f2)
        job_name=$(echo "$result" | cut -d'|' -f3)
        icon=$(echo "$result" | cut -d'|' -f4)

        # Show workflow header when it changes
        if [ "$wf" != "$current_wf" ]; then
            current_wf="$wf"
            echo -e "${BLUE}│${NC} ${DIM}── $wf ──${NC}$(printf '%*s' "$((TABLE_WIDTH - 9 - ${#wf}))" '') ${BLUE}│${NC}"
        fi

        print_row "$job_name" "$icon"
    done
fi

echo -e "${BLUE}├─────────────────────────────────────────────────────────────┤${NC}"
echo -e "${BLUE}│${NC} ${DIM}Duration: ${MINUTES}m ${SECS}s${NC}$(printf '%*s' "$((TABLE_WIDTH - 16 - ${#MINUTES} - ${#SECS}))" '') ${BLUE}│${NC}"
echo -e "${BLUE}└─────────────────────────────────────────────────────────────┘${NC}"

# ============================================================
# Display job reports (step summaries, artifacts, console logs)
# ============================================================
echo "$ALL_JOB_RESULTS" | while IFS= read -r result; do
    [ -z "$result" ] && continue

    wf=$(echo "$result" | cut -d'|' -f1)
    job_id=$(echo "$result" | cut -d'|' -f2)
    job_name=$(echo "$result" | cut -d'|' -f3)
    icon=$(echo "$result" | cut -d'|' -f4)

    # Find workflow ID for artifact paths
    wf_id=""
    for i in "${!CI_WORKFLOW_NAMES[@]}"; do
        if [ "${CI_WORKFLOW_NAMES[$i]}" = "$wf" ]; then
            wf_id="${CI_WORKFLOW_IDS[$i]}"
            break
        fi
    done
    job_dir="$ARTIFACTS_DIR/$wf_id/$job_id"

    has_summary=false
    has_artifacts=false
    has_logs=false
    [ -f "$job_dir/step-summary.md" ] && [ -s "$job_dir/step-summary.md" ] && has_summary=true
    [ -d "$job_dir/artifacts" ] && [ "$(ls -A "$job_dir/artifacts" 2>/dev/null)" ] && has_artifacts=true
    [ -f "$job_dir/console.log" ] && [ -s "$job_dir/console.log" ] && has_logs=true

    # Skip jobs with no outputs
    if [ "$has_summary" = false ] && [ "$has_artifacts" = false ] && [ "$has_logs" = false ]; then
        continue
    fi

    echo ""
    echo -e "${icon} ${BLUE}${BOLD}$wf / $job_name${NC}"

    if [ "$has_summary" = true ]; then
        echo ""
        echo -e "  ${BOLD}Step Summary${NC}"
        echo ""
        sed 's/^/    /' "$job_dir/step-summary.md"
    fi

    if [ "$has_artifacts" = true ]; then
        echo ""
        echo -e "  ${BOLD}Artifacts${NC}"
        echo ""
        for artifact in "$job_dir/artifacts"/*/; do
            [ -d "$artifact" ] || continue
            artifact_name=$(basename "$artifact")
            if [ -f "$artifact/index.html" ]; then
                echo -e "    ${DIM}• $artifact_name: .act-artifacts/$wf_id/$job_id/artifacts/$artifact_name/index.html${NC}"
            else
                echo -e "    ${DIM}• $artifact_name: .act-artifacts/$wf_id/$job_id/artifacts/$artifact_name/${NC}"
            fi
        done
    fi

    if [ "$has_logs" = true ]; then
        echo ""
        echo -e "  ${BOLD}Console Log${NC}"
        echo -e "    ${DIM}• .act-artifacts/$wf_id/$job_id/console.log${NC}"
    fi
done

echo ""
if [ "$OVERALL_FAILED" = true ]; then
    echo -e "${RED}Some jobs failed. Check output above for details.${NC}"
    echo ""
    echo -e "${DIM}Run log saved to: .act-artifacts/summary.log${NC}"
else
    echo -e "${GREEN}All jobs passed!${NC}"
    echo ""
    echo -e "${DIM}Run log saved to: .act-artifacts/summary.log${NC}"
fi

} 2>&1 | tee "$RUN_LOG.raw"

# Strip ANSI escape codes from the log file (keep clean text only)
sed 's/\x1b\[[0-9;]*m//g' "$RUN_LOG.raw" > "$RUN_LOG"
rm -f "$RUN_LOG.raw"

# Exit with failure if any jobs failed
if [ "$OVERALL_FAILED" = true ]; then
    exit 1
else
    exit 0
fi
