#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONVEX_DIR="$PROJECT_DIR/packages/backend"

AUTO_CONFIRM=false
if [[ "${1:-}" == "--yes" || "${1:-}" == "-y" ]]; then
    AUTO_CONFIRM=true
fi

echo ""
echo -e "${BLUE}  Nuke Local Convex Database (anonymous mode)${NC}"
echo ""

cd "$PROJECT_DIR"

if [ "$AUTO_CONFIRM" = false ] && [ -t 0 ]; then
    read -r -p "This will create a fresh local deployment and discard current local dev data. Continue? [y/N] " answer
    if [[ ! "$answer" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Aborted.${NC}"
        echo ""
        exit 0
    fi
fi

TIMESTAMP="$(date +%Y%m%d%H%M%S)"
PROJECT_SLUG="local-reset-${TIMESTAMP}"

echo -e "${BLUE}▶ Creating fresh local Convex deployment...${NC}"
echo -e "  Project slug: ${YELLOW}${PROJECT_SLUG}${NC}"

(
    cd "$CONVEX_DIR"
    CONVEX_AGENT_MODE=anonymous npx convex dev --once --configure=new --dev-deployment=local --project "$PROJECT_SLUG"
)

echo ""
echo -e "${GREEN}✔ Local Convex database reset complete${NC}"
echo -e "  Start dev again with: ${BLUE}bun run dev${NC}"
echo ""
