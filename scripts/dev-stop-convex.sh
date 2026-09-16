#!/bin/bash

# Stop only the Convex server for THIS worktree (leaves Next.js apps running)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/.dev-pids"

# Recursively get all descendant PIDs
get_descendants() {
    local pid=$1
    local children=$(pgrep -P $pid 2>/dev/null)
    for child in $children; do
        echo $child
        get_descendants $child
    done
}

if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}No .dev-pids file found — is the dev server running?${NC}"
    exit 1
fi

CONVEX_PID=$(grep '^convex:' "$PID_FILE" 2>/dev/null | cut -d: -f2)

if [ -z "$CONVEX_PID" ]; then
    echo -e "${YELLOW}No Convex process tracked in .dev-pids${NC}"
    exit 1
fi

if ! kill -0 "$CONVEX_PID" 2>/dev/null; then
    echo -e "${YELLOW}Convex process (PID: $CONVEX_PID) already stopped${NC}"
    # Clean up the convex entry from the PID file
    grep -v '^convex:' "$PID_FILE" > "$PID_FILE.tmp" && mv "$PID_FILE.tmp" "$PID_FILE"
    exit 0
fi

# Kill all descendants first (includes convex-local-backend)
descendants=$(get_descendants "$CONVEX_PID")
for desc_pid in $descendants; do
    kill $desc_pid 2>/dev/null || true
done

# Kill the main process
kill "$CONVEX_PID" 2>/dev/null || true
sleep 0.5

# Force kill any survivors
for desc_pid in $descendants; do
    if kill -0 $desc_pid 2>/dev/null; then
        kill -9 $desc_pid 2>/dev/null || true
    fi
done
if kill -0 "$CONVEX_PID" 2>/dev/null; then
    kill -9 "$CONVEX_PID" 2>/dev/null || true
fi

# Remove convex entry from PID file (keep other entries like next-web, next-admin)
grep -v '^convex:' "$PID_FILE" > "$PID_FILE.tmp" && mv "$PID_FILE.tmp" "$PID_FILE"

# Clean up Convex log
rm -f "$PROJECT_DIR/.convex-dev.log" 2>/dev/null

echo -e "${GREEN}✔ Convex server stopped (PID: $CONVEX_PID)${NC}"
