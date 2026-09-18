#!/bin/bash
#
# ensure-branch-tracking.sh
#
# Checks if the current branch tracks a remote branch with a matching name.
# If not, warns the user and suggests how to fix it.
#
# This script NEVER pushes or modifies git configuration automatically.
# It only informs the user and lets them decide what to do.
#
# Also installs a pre-push hook as a safety net to warn about
# pushes to differently-named branches.
#
# Usage:
#   ./scripts/ensure-branch-tracking.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo -e "${BLUE}Checking branch tracking...${NC}"

# ============================================================
# GET CURRENT BRANCH INFO
# ============================================================
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")

if [ -z "$CURRENT_BRANCH" ]; then
    echo -e "  ${YELLOW}Not on a branch (detached HEAD) - skipping checks${NC}"
    exit 0
fi

echo -e "  Current branch:  ${BLUE}$CURRENT_BRANCH${NC}"

# ============================================================
# CHECK BRANCH TRACKING
# ============================================================
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "")

if [ -z "$UPSTREAM" ]; then
    # No upstream configured
    echo -e "  Upstream: ${YELLOW}not configured${NC}"
    echo ""
    echo -e "  ${YELLOW}Warning: No upstream tracking configured${NC}"
    echo -e "  Push and Sync operations may not work as expected."
    echo ""
    echo -e "  To set up tracking (this will push your commits), run:"
    echo -e "    ${BLUE}git push -u origin $CURRENT_BRANCH${NC}"
    echo ""
    TRACKING_OK=false
else
    echo -e "  Upstream: ${BLUE}$UPSTREAM${NC}"

    # Extract the remote branch name (part after the remote name)
    REMOTE_NAME=$(echo "$UPSTREAM" | cut -d'/' -f1)
    REMOTE_BRANCH=$(echo "$UPSTREAM" | cut -d'/' -f2-)

    if [ "$REMOTE_BRANCH" != "$CURRENT_BRANCH" ]; then
        # Tracking a differently-named remote branch
        echo ""
        echo -e "  ${YELLOW}Warning: Branch tracking mismatch${NC}"
        echo -e "  Push/Sync will go to '${RED}$REMOTE_BRANCH${NC}', not '$CURRENT_BRANCH'."
        echo ""

        # Check if a matching remote branch already exists
        if git ls-remote --heads "$REMOTE_NAME" "$CURRENT_BRANCH" 2>/dev/null | grep -q "$CURRENT_BRANCH"; then
            echo -e "  Remote branch '${BLUE}$REMOTE_NAME/$CURRENT_BRANCH${NC}' exists."
            echo -e "  To fix tracking without pushing, run:"
            echo -e "    ${BLUE}git branch --set-upstream-to=$REMOTE_NAME/$CURRENT_BRANCH${NC}"
        else
            echo -e "  Remote branch '${BLUE}$REMOTE_NAME/$CURRENT_BRANCH${NC}' does not exist yet."
            echo -e "  To create it and fix tracking (this will push your commits), run:"
            echo -e "    ${BLUE}git push -u $REMOTE_NAME $CURRENT_BRANCH${NC}"
        fi
        echo ""
        TRACKING_OK=false
    else
        echo -e "  ${GREEN}✔ Tracking matches branch name${NC}"
        TRACKING_OK=true
    fi
fi

# ============================================================
# INSTALL PRE-PUSH HOOK (safety net)
# ============================================================
echo ""
echo -e "${BLUE}Checking pre-push hook...${NC}"

GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null || git rev-parse --git-dir)
HOOK_PATH="$GIT_COMMON_DIR/hooks/pre-push"

install_hook() {
    mkdir -p "$(dirname "$HOOK_PATH")"
    cat > "$HOOK_PATH" << 'HOOK_EOF'
#!/bin/bash
#
# Pre-push hook: Warns when pushing to a branch different from the current branch
#
# This hook is installed by ensure-branch-tracking.sh
#

current_branch=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")

while read local_ref local_sha remote_ref remote_sha; do
    # Skip non-branch refs (tags, notes, etc.) - only check refs/heads/*
    case "$remote_ref" in
        refs/heads/*) ;;
        *) continue ;;
    esac

    # Extract the remote branch name from refs/heads/xxx
    remote_branch="${remote_ref#refs/heads/}"

    if [ -n "$current_branch" ] && [ "$remote_branch" != "$current_branch" ]; then
        echo ""
        echo "WARNING: Pushing to a different branch than your current branch!"
        echo ""
        echo "  Current branch: $current_branch"
        echo "  Pushing to:     $remote_branch"
        echo ""
        echo "  If this is intentional, the push will proceed."
        echo "  To push to your own branch instead, run:"
        echo "    git push -u origin $current_branch"
        echo ""
        # Allow the push but warn - user can Ctrl+C if unintended
    fi
done

exit 0
HOOK_EOF
    chmod +x "$HOOK_PATH"
}

if [ ! -f "$HOOK_PATH" ]; then
    echo -e "  Installing pre-push safety hook..."
    install_hook
    echo -e "  ${GREEN}✔ Pre-push hook installed${NC}"
    HOOK_INSTALLED=true
elif grep -q "ensure-branch-tracking.sh" "$HOOK_PATH" 2>/dev/null; then
    echo -e "  ${GREEN}✔ Pre-push hook already installed${NC}"
    HOOK_INSTALLED=true
else
    echo -e "  ${YELLOW}Pre-push hook exists but was installed by something else - not modifying${NC}"
    HOOK_INSTALLED=false
fi

# ============================================================
# SUMMARY
# ============================================================
echo ""
if [ "$TRACKING_OK" = true ] && [ "$HOOK_INSTALLED" = true ]; then
    echo -e "${GREEN}✔ Branch tracking configuration OK${NC}"
else
    echo -e "${YELLOW}Branch tracking check complete - see warnings above${NC}"
fi
