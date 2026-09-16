#!/bin/bash

# dev-nuke-all.sh — Find and kill ALL node/next/convex processes related to
# this repo across ALL worktrees and branches. Shows open file descriptor
# counts before and after so you can confirm the cleanup worked.
#
# Compatible with macOS default bash (3.2+).

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Derive the repo name to match across all worktrees.
# In a worktree, --git-common-dir points to the main repo's .git dir,
# e.g. /Users/x/web-app-starter/.git → basename of parent → "web-app-starter"
# Falls back to --show-toplevel for non-worktree checkouts.
GIT_COMMON_DIR=$(cd "$PROJECT_DIR" && git rev-parse --git-common-dir 2>/dev/null || echo "")
if [ -n "$GIT_COMMON_DIR" ] && [ "$GIT_COMMON_DIR" != ".git" ]; then
    # Worktree: GIT_COMMON_DIR is e.g. /Users/x/web-app-starter/.git
    REPO_NAME=$(basename "$(dirname "$GIT_COMMON_DIR")")
else
    # Regular checkout: use toplevel
    REPO_NAME=$(cd "$PROJECT_DIR" && basename "$(git rev-parse --show-toplevel 2>/dev/null || echo "$PROJECT_DIR")")
fi

# ── Gather open file descriptor count ──────────────────────────────────────────
get_open_files() {
    if command -v lsof &>/dev/null; then
        # lsof returns non-zero when no matching processes exist; ignore that
        local count
        count=$(lsof -c node -c convex -c bun 2>/dev/null | wc -l | tr -d ' ') || true
        echo "${count:-0}"
    else
        echo "n/a"
    fi
}

# ── Discover processes ─────────────────────────────────────────────────────────
# Searches for node/bun/convex processes whose command line mentions the repo
# name, plus any convex-local-backend. Also checks .dev-pids files from any
# worktree found via `git worktree list`.
discover_processes() {
    local seen=" "
    local tmp_pids=""

    add_pid() {
        local pid=$1
        case "$seen" in
            *" $pid "*) return ;;
        esac
        # Skip our own process and parent shell
        [ "$pid" = "$$" ] && return
        [ "$pid" = "$PPID" ] && return
        kill -0 "$pid" 2>/dev/null || return
        seen="$seen$pid "
        tmp_pids="$tmp_pids $pid"
    }

    # Also add all descendants of a given PID (catches intermediate shells,
    # npm wrappers, etc. that don't mention the repo name in their args)
    add_tree() {
        local root=$1
        add_pid "$root"
        local children
        children=$(pgrep -P "$root" 2>/dev/null || true)
        for child in $children; do
            add_tree "$child"
        done
    }

    # Match any process whose args contain the repo name
    for pid in $(pgrep -f "$REPO_NAME" 2>/dev/null || true); do
        add_pid "$pid"
    done

    # Catch convex-local-backend regardless of path
    for pid in $(pgrep -f "convex-local-backend" 2>/dev/null || true); do
        add_pid "$pid"
    done

    # Catch "convex dev" processes (npm exec convex dev, etc.)
    for pid in $(pgrep -f "convex dev" 2>/dev/null || true); do
        add_pid "$pid"
    done

    # Check .dev-pids files in all known worktrees — add the tracked PID
    # and its entire process tree (children, grandchildren, etc.)
    if command -v git &>/dev/null; then
        while IFS= read -r wt_line; do
            local wt_dir
            wt_dir=$(echo "$wt_line" | awk '{print $1}')
            if [ -f "$wt_dir/.dev-pids" ]; then
                while IFS= read -r line; do
                    local pid
                    pid=$(echo "$line" | cut -d':' -f2)
                    [ -n "$pid" ] && add_tree "$pid"
                done < "$wt_dir/.dev-pids"
            fi
        done < <(cd "$PROJECT_DIR" && git worktree list 2>/dev/null || true)
    fi

    echo "$tmp_pids"
}

# ── Classify a process for display ─────────────────────────────────────────────
classify_process() {
    local args=$1
    case "$args" in
        *convex-local-backend*) echo "convex-backend" ;;
        *"convex dev"*)         echo "convex-cli" ;;
        *"next dev"*)           echo "next-dev" ;;
        *"next-server"*)        echo "next-server" ;;
        *esbuild*)              echo "esbuild" ;;
        *dev-start.sh*)         echo "dev-start" ;;
        *node*)                 echo "node" ;;
        *npm*)                  echo "npm" ;;
        *)                      echo "process" ;;
    esac
}

# ── Format a single process for display ────────────────────────────────────────
format_process() {
    local pid=$1
    local cmdline label
    cmdline=$(ps -p "$pid" -o args= 2>/dev/null || echo "???")
    label=$(classify_process "$cmdline")
    if [ ${#cmdline} -gt 80 ]; then
        cmdline="${cmdline:0:77}..."
    fi
    printf "  ${BOLD}%6s${NC}  %-16s  ${DIM}%s${NC}\n" "$pid" "$label" "$cmdline"
}

# ── Main ───────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}  dev-nuke-all — kill ALL dev processes for repo: ${BOLD}$REPO_NAME${NC}"
echo -e "  ${DIM}(matches all worktrees and branches)${NC}"
echo ""

open_before=$(get_open_files)
echo -e "${YELLOW}  Open files (node/convex/bun):${NC} $open_before"
echo ""

raw_pids=$(discover_processes)

# Build array (bash 3.2 compatible)
PIDS=()
for p in $raw_pids; do
    PIDS+=("$p")
done

if [ ${#PIDS[@]} -eq 0 ]; then
    echo -e "${GREEN}  No matching processes found.${NC}"
    echo ""
else
    echo -e "${YELLOW}  Found ${#PIDS[@]} process(es):${NC}"
    echo ""
    printf "  ${DIM}%6s  %-16s  %s${NC}\n" "PID" "COMMAND" "ARGS"
    printf "  ${DIM}%6s  %-16s  %s${NC}\n" "──────" "────────────────" "────────────────────────────"
    for pid in "${PIDS[@]}"; do
        format_process "$pid"
    done
    echo ""

    echo -ne "${RED}  Kill all ${#PIDS[@]} process(es) and clean up caches? [y/N] ${NC}"
    read -r answer
    echo ""

    if [[ ! "$answer" =~ ^[yY]$ ]]; then
        echo -e "${YELLOW}  Aborted.${NC}"
        echo ""
        exit 0
    fi

    # Kill — graceful first, then force
    killed=0
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            killed=$((killed + 1))
        fi
    done

    sleep 1

    forced=0
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
            forced=$((forced + 1))
        fi
    done

    force_msg=""
    if [ "$forced" -gt 0 ]; then
        force_msg=" ($forced force-killed)"
    fi
    echo -e "${GREEN}  Killed $killed process(es)${NC}${DIM}$force_msg${NC}"
    echo ""

    sleep 1

    open_after=$(get_open_files)
    echo -e "${YELLOW}  Open files (node/convex/bun):${NC} before=$open_before → after=$open_after"
    echo ""
fi

# ── Clean up .dev-pids and log files across all worktrees ─────────────────────
if command -v git &>/dev/null; then
    while IFS= read -r wt_line; do
        local_wt=$(echo "$wt_line" | awk '{print $1}')
        rm -f "$local_wt/.dev-pids" 2>/dev/null || true
        rm -f "$local_wt/.convex-dev.log" 2>/dev/null || true
        rm -f "$local_wt/.next-web.log" 2>/dev/null || true
        rm -f "$local_wt/.next-admin.log" 2>/dev/null || true
        rm -f "$local_wt/.next-landing.log" 2>/dev/null || true
        rm -f "$local_wt/.next-storybook.log" 2>/dev/null || true
        rm -f "$local_wt/.next-dev.log" 2>/dev/null || true
    done < <(cd "$PROJECT_DIR" && git worktree list 2>/dev/null || true)
fi

# ── Clean build caches (.next, .turbo) across all worktrees ───────────────────
echo -e "${YELLOW}  Cleaning build caches (.next, .turbo)...${NC}"
cache_cleaned=0
if command -v git &>/dev/null; then
    while IFS= read -r wt_line; do
        wt_dir=$(echo "$wt_line" | awk '{print $1}')
        for cache_dir in \
            "$wt_dir/apps/web/.next" \
            "$wt_dir/apps/admin/.next" \
            "$wt_dir/apps/landing/.next" \
            "$wt_dir/apps/storybook/.next" \
            "$wt_dir/.turbo"; do
            if [ -d "$cache_dir" ]; then
                rm -rf "$cache_dir"
                cache_cleaned=$((cache_cleaned + 1))
            fi
        done
    done < <(cd "$PROJECT_DIR" && git worktree list 2>/dev/null || true)
fi
if [ "$cache_cleaned" -gt 0 ]; then
    echo -e "${GREEN}  ✔ Removed $cache_cleaned cache director(ies)${NC}"
else
    echo -e "${GREEN}  ✔ No build caches found${NC}"
fi
echo ""

# ── Clean stale Convex state directories ──────────────────────────────────────
CONVEX_STATE_DIR="$HOME/.convex/anonymous-convex-backend-state"
if [ -d "$CONVEX_STATE_DIR" ]; then
    echo -e "${YELLOW}  Cleaning stale Convex state...${NC}"

    # Collect deployment names referenced by any worktree
    ACTIVE_DEPLOYMENTS=" "
    if command -v git &>/dev/null; then
        while IFS= read -r wt_line; do
            wt_dir=$(echo "$wt_line" | awk '{print $1}')
            for env_file in "$wt_dir/packages/backend/.env.local" "$wt_dir/.env.local"; do
                if [ -f "$env_file" ]; then
                    dep=$(grep "^CONVEX_DEPLOYMENT=" "$env_file" 2>/dev/null | sed 's/CONVEX_DEPLOYMENT=//' | sed 's/ #.*//' | sed 's/anonymous://')
                    if [ -n "$dep" ]; then
                        ACTIVE_DEPLOYMENTS="$ACTIVE_DEPLOYMENTS$dep "
                        break
                    fi
                fi
            done
        done < <(cd "$PROJECT_DIR" && git worktree list 2>/dev/null || true)
    fi

    stale_count=0
    stale_size=0
    for state_dir in "$CONVEX_STATE_DIR"/*/; do
        [ -d "$state_dir" ] || continue
        dir_name=$(basename "$state_dir")
        [ "$dir_name" = "." ] || [ "$dir_name" = ".." ] && continue
        case "$ACTIVE_DEPLOYMENTS" in
            *" $dir_name "*)
                # Active — leave it alone
                ;;
            *)
                # Stale — calculate size then remove
                dir_size=$(du -sk "$state_dir" 2>/dev/null | awk '{print $1}')
                stale_size=$((stale_size + ${dir_size:-0}))
                rm -rf "$state_dir"
                stale_count=$((stale_count + 1))
                ;;
        esac
    done

    if [ "$stale_count" -gt 0 ]; then
        if [ "$stale_size" -ge 1048576 ]; then
            human_size="$((stale_size / 1048576)) GB"
        elif [ "$stale_size" -ge 1024 ]; then
            human_size="$((stale_size / 1024)) MB"
        else
            human_size="${stale_size} KB"
        fi
        echo -e "${GREEN}  ✔ Removed $stale_count stale Convex state director(ies) ($human_size freed)${NC}"
    else
        echo -e "${GREEN}  ✔ No stale Convex state found${NC}"
    fi
    echo ""
fi

# ── Clean node_modules across all worktrees ───────────────────────────────────
echo -e "${YELLOW}  Cleaning node_modules across all worktrees...${NC}"
nm_cleaned=0
if command -v git &>/dev/null; then
    while IFS= read -r wt_line; do
        wt_dir=$(echo "$wt_line" | awk '{print $1}')
        if [ -d "$wt_dir/node_modules" ]; then
            rm -rf "$wt_dir/node_modules"
            nm_cleaned=$((nm_cleaned + 1))
        fi
        # App-level and package-level node_modules (from hoisting issues)
        for sub_nm in "$wt_dir"/apps/*/node_modules "$wt_dir"/packages/*/node_modules; do
            if [ -d "$sub_nm" ]; then
                rm -rf "$sub_nm"
                nm_cleaned=$((nm_cleaned + 1))
            fi
        done
    done < <(cd "$PROJECT_DIR" && git worktree list 2>/dev/null || true)
fi
if [ "$nm_cleaned" -gt 0 ]; then
    echo -e "${GREEN}  ✔ Removed $nm_cleaned node_modules director(ies)${NC}"
else
    echo -e "${GREEN}  ✔ No node_modules found${NC}"
fi
echo ""

# ── Done ──────────────────────────────────────────────────────────────────────
echo -e "${GREEN}  Done. Run ${BOLD}bun install && bun run dev${NC}${GREEN} to restart.${NC}"
echo ""
