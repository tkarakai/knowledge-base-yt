#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
#  Staging Infrastructure Setup
#
#  Interactive script that walks through one-time staging setup for:
#    - Convex (backend project + environment variables)
#    - Vercel (3 staging projects + environment variables)
#    - GitHub (staging environment + secrets + branch protection)
#
#  Based on docs/deployment-runbook.md sections 2a–2e (staging only).
#
#  Usage: bun run infra:setup:staging
#         ./scripts/infra-setup-staging.sh
#         ./scripts/infra-setup-staging.sh --help
# ============================================================================

# Colors for output (matching dev-start.sh)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Timestamped output files
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
RECORD_FILE="$PROJECT_DIR/.infra-setup-staging-record-${TIMESTAMP}"
LOG_FILE="$PROJECT_DIR/.infra-setup-staging-log-${TIMESTAMP}"

# Temp dir for Vercel CLI project linking (cleaned up at exit)
TMPDIR_VERCEL=""

# ============================================================
# HELP
# ============================================================

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Staging Infrastructure Setup"
    echo ""
    echo "Interactive script that sets up Convex, Vercel, and GitHub"
    echo "for the staging environment. Based on the deployment runbook."
    echo ""
    echo "Usage: ./scripts/infra-setup-staging.sh"
    echo "       bun run infra:setup:staging"
    echo ""
    echo "The script will:"
    echo "  Phase 1: Collect all inputs upfront (with guided manual steps for Convex)"
    echo "  Phase 2: Show a summary and ask for confirmation"
    echo "  Phase 3: Execute each step with individual confirmation"
    echo ""
    echo "Output files (timestamped, gitignored):"
    echo "  .infra-setup-staging-record-*  Configuration record (contains secrets)"
    echo "  .infra-setup-staging-log-*     Full console log of the session"
    echo ""
    echo "Re-running the script checks live services for existing resources."
    exit 0
fi

# ============================================================
# HELPER FUNCTIONS
# ============================================================

log_info() {
    echo -e "${BLUE}  ℹ $1${NC}"
}

log_success() {
    echo -e "${GREEN}  ✓ $1${NC}"
}

log_error() {
    echo -e "${RED}  ✗ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}  ⚠ $1${NC}"
}

log_step() {
    echo ""
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  $1${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Read a value from the user with prompt and optional default.
# Prints the trimmed value to stdout.
# Usage: MY_VAR=$(ask_input "Prompt text" "default_value")
ask_input() {
    local prompt="$1"
    local default="${2:-}"
    local value

    if [ -n "$default" ]; then
        echo -ne "  ${prompt} [${DIM}${default}${NC}]: " >&2
    else
        echo -ne "  ${prompt}: " >&2
    fi

    read -r value
    # Append user input to log file (the chunk-based perl pipeline flushes
    # the no-newline prompt before we get here, so ordering is correct)
    [ -n "${LOG_FILE:-}" ] && echo "$value" >> "$LOG_FILE"
    value="${value:-$default}"
    # Trim whitespace
    value="$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

    if [ -z "$value" ]; then
        echo -e "${RED}  ✗ A value is required.${NC}" >&2
        ask_input "$prompt" "$default"
        return
    fi

    echo "$value"
}

# Read a secret value (hidden input). Prints the trimmed value to stdout.
# Usage: MY_SECRET=$(ask_secret "Prompt text")
ask_secret() {
    local prompt="$1"
    local value

    echo -ne "  ${prompt}: " >&2
    read -rs value
    echo "****" >&2  # redacted marker (via tee pipeline for correct ordering)

    # Trim whitespace
    value="$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

    if [ -z "$value" ]; then
        echo -e "${RED}  ✗ A value is required.${NC}" >&2
        ask_secret "$prompt"
        return
    fi

    echo "$value"
}

# Ask for confirmation. Returns 0 for yes, 1 for no.
# Usage: ask_confirm "Continue?" || exit 1
ask_confirm() {
    local prompt="${1:-Continue?}"
    local answer

    echo -ne "  ${prompt} [y/N]: "
    read -r answer
    [ -n "${LOG_FILE:-}" ] && echo "$answer" >> "$LOG_FILE"

    case "$answer" in
        [yY]|[yY][eE][sS]) return 0 ;;
        *) return 1 ;;
    esac
}

# Append a key=value pair to the record file.
# Usage: record_value "KEY" "value"
record_value() {
    local key="$1"
    local value="$2"

    # Overwrite if key already exists
    if grep -q "^${key}=" "$RECORD_FILE" 2>/dev/null; then
        local tmp="${RECORD_FILE}.tmp"
        grep -v "^${key}=" "$RECORD_FILE" > "$tmp"
        echo "${key}=${value}" >> "$tmp"
        mv "$tmp" "$RECORD_FILE"
    else
        echo "${key}=${value}" >> "$RECORD_FILE"
    fi
}

# Read a value from the record file. Prints to stdout, empty string if not found.
# Usage: val=$(record_get "KEY")
record_get() {
    local key="$1"
    if [ -f "$RECORD_FILE" ]; then
        grep "^${key}=" "$RECORD_FILE" 2>/dev/null | head -1 | cut -d'=' -f2- || true
    fi
}

# Global cleanup
cleanup() {
    if [ -n "$TMPDIR_VERCEL" ] && [ -d "$TMPDIR_VERCEL" ]; then
        rm -rf "$TMPDIR_VERCEL"
    fi
}

# Global error handler
on_error() {
    local line=$1
    cleanup
    echo ""
    log_error "Script failed at line $line"
    echo ""
    echo "  Record file: $RECORD_FILE"
    echo "  Session log: $LOG_FILE"
    echo ""
    echo "  Re-run the script to resume. Existing resources will be detected."
    echo ""
    sleep 0.1  # let tee flush
    exit 1
}

trap 'on_error $LINENO' ERR
trap cleanup EXIT

# ============================================================
# COLLECTED VALUES (global variables)
# ============================================================

GITHUB_REPO=""
PROJECT_PREFIX=""
CONVEX_STAGING_URL=""
CONVEX_STAGING_SITE_URL=""
CONVEX_STAGING_DEPLOY_KEY=""
VERCEL_TOKEN=""
VERCEL_ORG_ID=""
VERCEL_WEB_NAME=""
VERCEL_ADMIN_NAME=""
VERCEL_LANDING_NAME=""
VERCEL_WEB_URL=""
VERCEL_ADMIN_URL=""
VERCEL_LANDING_URL=""

# Project IDs populated during step 1
VERCEL_PROJECT_WEB_STAGING_ID=""
VERCEL_PROJECT_ADMIN_STAGING_ID=""
VERCEL_PROJECT_LANDING_STAGING_ID=""

# ============================================================
# PHASE 0: PREREQUISITES
# ============================================================

check_prerequisites() {
    log_step "Pre-flight Checks"

    local missing=()

    command -v gh >/dev/null 2>&1 || missing+=("gh (install: brew install gh)")
    command -v vercel >/dev/null 2>&1 || missing+=("vercel (install: bun add -g vercel)")
    command -v bunx >/dev/null 2>&1 || missing+=("bunx (install bun)")
    command -v jq >/dev/null 2>&1 || missing+=("jq (install: brew install jq)")
    command -v openssl >/dev/null 2>&1 || missing+=("openssl")
    command -v curl >/dev/null 2>&1 || missing+=("curl")

    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required tools:"
        for tool in "${missing[@]}"; do
            echo "    - $tool"
        done
        exit 1
    fi
    log_success "All required CLI tools found"

    # Check gh auth
    if ! gh auth status >/dev/null 2>&1; then
        log_error "GitHub CLI is not authenticated. Run: gh auth login"
        exit 1
    fi
    log_success "GitHub CLI authenticated"

    # Check vercel auth
    if ! vercel whoami >/dev/null 2>&1; then
        log_error "Vercel CLI is not authenticated. Run: vercel login"
        exit 1
    fi
    log_success "Vercel CLI authenticated ($(vercel whoami 2>/dev/null))"

    # Check convex
    if ! bunx convex --version >/dev/null 2>&1; then
        log_error "Convex CLI not available. Check your bun installation."
        exit 1
    fi
    log_success "Convex CLI available ($(bunx convex --version 2>/dev/null))"
}

# ============================================================
# PHASE 1: COLLECT ALL INPUTS
# ============================================================

collect_inputs() {
    # --- GitHub repo ---
    log_step "Phase 1: Collect Inputs"

    echo ""
    log_info "Detecting GitHub repository..."
    local detected_repo
    detected_repo=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo "")
    if [ -n "$detected_repo" ]; then
        GITHUB_REPO=$(ask_input "GitHub repository (owner/repo)" "$detected_repo")
    else
        log_warn "Could not auto-detect repository"
        GITHUB_REPO=$(ask_input "GitHub repository (owner/repo)" "")
    fi

    # --- Project prefix ---
    echo ""
    log_info "Choose a project name prefix. This will be used for:"
    echo "    - Vercel project names: {prefix}-web-staging, {prefix}-admin-staging, {prefix}-landing-staging"
    echo ""
    local default_prefix
    default_prefix=$(echo "$GITHUB_REPO" | cut -d'/' -f2)
    PROJECT_PREFIX=$(ask_input "Project name prefix" "$default_prefix")

    # --- Convex (manual dashboard steps) ---
    echo ""
    log_step "Phase 1, Step 1: Convex Staging Project (Manual Steps)"
    echo ""
    echo "  The Convex CLI cannot create projects or generate deploy keys."
    echo "  You need to do this in the Convex dashboard."
    echo ""
    echo -e "  ${BOLD}Open: https://dashboard.convex.dev${NC}"
    echo ""
    echo -e "  1. Click ${BOLD}Create Project${NC} and name it ${BOLD}${PROJECT_PREFIX}-staging${NC}"
    echo -e "  2. In the project, go to ${BOLD}Settings > General${NC}"
    echo -e "  3. Make sure ${BOLD}Production${NC} deployment is selected"
    echo -e "  4. Copy the ${BOLD}Deployment URL${NC} (looks like https://xxx.convex.cloud)"
    echo -e "  5. Copy the ${BOLD}HTTP Actions URL${NC} (looks like https://xxx.convex.site)"
    echo -e "  6. Go to ${BOLD}Settings > Deploy Keys${NC}"
    echo -e "  7. Click ${BOLD}Generate Production Deploy Key${NC}"
    echo -e "  8. Copy the deploy key (starts with ${BOLD}prod:${NC})"
    echo ""
    log_info "Press Enter when you're ready to paste the values..."
    read -r
    [ -n "${LOG_FILE:-}" ] && echo "" >> "$LOG_FILE"

    CONVEX_STAGING_URL=$(ask_input "Convex Deployment URL" "")
    if [[ ! "$CONVEX_STAGING_URL" =~ ^https://.*\.convex\.cloud$ ]]; then
        log_warn "URL doesn't match expected format (https://xxx.convex.cloud)"
        ask_confirm "Continue anyway?" || exit 1
    fi

    CONVEX_STAGING_SITE_URL=$(ask_input "Convex HTTP Actions URL" "")
    if [[ ! "$CONVEX_STAGING_SITE_URL" =~ ^https://.*\.convex\.site$ ]]; then
        log_warn "URL doesn't match expected format (https://xxx.convex.site)"
        ask_confirm "Continue anyway?" || exit 1
    fi

    CONVEX_STAGING_DEPLOY_KEY=$(ask_secret "Convex deploy key (hidden)")
    if [[ ! "$CONVEX_STAGING_DEPLOY_KEY" =~ ^prod: ]]; then
        log_warn "Deploy key doesn't start with 'prod:'"
        ask_confirm "Continue anyway?" || exit 1
    fi

    # Validate the deploy key by setting a test variable, then removing it
    echo ""
    log_info "Validating Convex deploy key (set + remove a test variable)..."
    if (cd "$PROJECT_DIR/packages/backend" && \
        CONVEX_DEPLOY_KEY="$CONVEX_STAGING_DEPLOY_KEY" bunx convex env set _SETUP_TEST "ok" 2>/dev/null && \
        CONVEX_DEPLOY_KEY="$CONVEX_STAGING_DEPLOY_KEY" bunx convex env remove _SETUP_TEST 2>/dev/null); then
        log_success "Deploy key is valid"
    else
        log_warn "Could not validate deploy key"
        ask_confirm "Continue anyway?" || exit 1
    fi

    # --- Vercel token ---
    echo ""
    log_step "Phase 1, Step 2: Vercel Personal Access Token"
    echo ""
    echo "  A Vercel personal access token is needed for:"
    echo "    - Configuring project settings (root directory, framework)"
    echo "    - GitHub Actions deployments (stored as VERCEL_TOKEN secret)"
    echo ""
    echo -e "  ${BOLD}Create one at: https://vercel.com/account/tokens${NC}"
    echo "  Recommended: full access scope, no expiration"
    echo ""

    VERCEL_TOKEN=$(ask_secret "Vercel personal access token (hidden)")

    # Validate the token and get org ID
    echo ""
    log_info "Validating Vercel token and detecting org ID..."
    local vercel_user_response
    vercel_user_response=$(curl -sf -H "Authorization: Bearer $VERCEL_TOKEN" \
        "https://api.vercel.com/v2/user") || {
        log_error "Invalid Vercel token. Could not authenticate."
        exit 1
    }

    VERCEL_ORG_ID=$(echo "$vercel_user_response" | jq -r '.user.id // empty')
    local vercel_username
    vercel_username=$(echo "$vercel_user_response" | jq -r '.user.username // empty')

    if [ -z "$VERCEL_ORG_ID" ]; then
        log_error "Could not extract Vercel user/org ID from token"
        exit 1
    fi
    log_success "Vercel token valid (user: $vercel_username, ID: $VERCEL_ORG_ID)"

    # Derive Vercel project names and URLs
    VERCEL_WEB_NAME="${PROJECT_PREFIX}-web-staging"
    VERCEL_ADMIN_NAME="${PROJECT_PREFIX}-admin-staging"
    VERCEL_LANDING_NAME="${PROJECT_PREFIX}-landing-staging"
    VERCEL_WEB_URL="https://${VERCEL_WEB_NAME}.vercel.app"
    VERCEL_ADMIN_URL="https://${VERCEL_ADMIN_NAME}.vercel.app"
    VERCEL_LANDING_URL="https://${VERCEL_LANDING_NAME}.vercel.app"
}

# ============================================================
# PHASE 2: REVIEW
# ============================================================

print_summary() {
    log_step "Phase 2: Review"
    echo ""
    echo -e "  ${BOLD}GitHub${NC}"
    echo "    Repository:          $GITHUB_REPO"
    echo ""
    echo -e "  ${BOLD}Convex Staging${NC}"
    echo "    Deployment URL:      $CONVEX_STAGING_URL"
    echo "    HTTP Actions URL:    $CONVEX_STAGING_SITE_URL"
    echo "    Deploy key:          ${CONVEX_STAGING_DEPLOY_KEY:0:12}..."
    echo ""
    echo -e "  ${BOLD}Vercel${NC}"
    echo "    Org/User ID:         $VERCEL_ORG_ID"
    echo "    Token:               ${VERCEL_TOKEN:0:8}..."
    echo "    Projects to create:"
    echo "      - $VERCEL_WEB_NAME       (root: apps/web)"
    echo "      - $VERCEL_ADMIN_NAME     (root: apps/admin)"
    echo "      - $VERCEL_LANDING_NAME   (root: apps/landing)"
    echo ""
    echo -e "  ${BOLD}Planned Phase 3 Execution Steps:${NC}"
    echo "    Step 1: Create 3 Vercel staging projects"
    echo "    Step 2: Set Convex environment variables (SITE_URL, ADMIN_SITE_URL, LANDING_URL, BETTER_AUTH_SECRET)"
    echo "    Step 3: Set Vercel environment variables on all 3 projects"
    echo "    Step 4: Create GitHub staging environment, set secrets, branch protection"
    echo "    Step 5: (Optional) Deploy Convex to staging and bootstrap first admin"
    echo ""
}

# ============================================================
# PHASE 3: EXECUTE
# ============================================================

# --- Phase 3, Step 1: Create Vercel Projects ---

# Create a single Vercel project, configure its settings, and store its ID.
# Args: project_name root_dir variable_name_for_id
create_vercel_project() {
    local project_name="$1"
    local root_dir="$2"
    local id_varname="$3"

    # Check if project already exists via API
    local response http_code body project_id
    response=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer $VERCEL_TOKEN" \
        "https://api.vercel.com/v9/projects/${project_name}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        project_id=$(echo "$body" | jq -r '.id // empty')
        if [ -n "$project_id" ]; then
            local existing_root existing_framework
            existing_root=$(echo "$body" | jq -r '.rootDirectory // "not set"')
            existing_framework=$(echo "$body" | jq -r '.framework // "not set"')
            log_warn "Project '$project_name' already exists (ID: $project_id)"
            log_warn "  rootDirectory: $existing_root, framework: $existing_framework"
            if ask_confirm "Overwrite project settings?"; then
                configure_vercel_project "$project_name" "$root_dir"
            else
                log_info "Keeping existing settings"
            fi
            printf -v "$id_varname" '%s' "$project_id"
            record_value "$id_varname" "$project_id"
            return 0
        fi
    fi

    # Create the project via CLI
    log_info "Creating project: $project_name"
    vercel project add "$project_name" --token "$VERCEL_TOKEN" 2>/dev/null || true

    # Fetch project ID after creation
    response=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer $VERCEL_TOKEN" \
        "https://api.vercel.com/v9/projects/${project_name}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" != "200" ]; then
        log_error "Failed to verify project '$project_name' after creation"
        echo "    HTTP $http_code: $(echo "$body" | jq -r '.error.message // empty' 2>/dev/null)"
        return 1
    fi

    project_id=$(echo "$body" | jq -r '.id // empty')
    if [ -z "$project_id" ]; then
        log_error "Could not get project ID for '$project_name'"
        return 1
    fi

    # Configure root directory and framework
    configure_vercel_project "$project_name" "$root_dir"

    # Store the ID
    printf -v "$id_varname" '%s' "$project_id"
    record_value "$id_varname" "$project_id"
    log_success "Created '$project_name' (ID: $project_id)"
}

# Set rootDirectory and framework on a Vercel project.
# This is the one REST API call with no CLI equivalent.
configure_vercel_project() {
    local project_name="$1"
    local root_dir="$2"

    log_info "Configuring $project_name: rootDirectory=$root_dir, framework=nextjs"
    local response http_code body
    response=$(curl -s -w "\n%{http_code}" -X PATCH \
        -H "Authorization: Bearer $VERCEL_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"rootDirectory\": \"$root_dir\", \"framework\": \"nextjs\"}" \
        "https://api.vercel.com/v9/projects/${project_name}")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -ge 400 ]; then
        log_error "Failed to configure project '$project_name'"
        echo "    HTTP $http_code: $(echo "$body" | jq -r '.error.message // empty' 2>/dev/null)"
        return 1
    fi
}

step_create_vercel_projects() {
    log_step "Phase 3, Step 1: Create Vercel Staging Projects"
    echo ""
    echo "  This will create 3 Vercel projects and configure each with"
    echo "  the correct root directory and Next.js framework preset."
    echo ""
    echo "  Note: The Vercel CLI has no command for project settings,"
    echo "  so one REST API call per project is used for rootDirectory"
    echo "  and framework. Everything else uses the CLI."
    echo ""

    if ! ask_confirm "Create Vercel staging projects?"; then
        log_warn "Skipped"
        return
    fi

    create_vercel_project "$VERCEL_WEB_NAME" "apps/web" "VERCEL_PROJECT_WEB_STAGING_ID"
    create_vercel_project "$VERCEL_ADMIN_NAME" "apps/admin" "VERCEL_PROJECT_ADMIN_STAGING_ID"
    create_vercel_project "$VERCEL_LANDING_NAME" "apps/landing" "VERCEL_PROJECT_LANDING_STAGING_ID"

    record_value "VERCEL_WEB_STAGING_URL" "$VERCEL_WEB_URL"
    record_value "VERCEL_ADMIN_STAGING_URL" "$VERCEL_ADMIN_URL"
    record_value "VERCEL_LANDING_STAGING_URL" "$VERCEL_LANDING_URL"
    record_value "VERCEL_WEB_STAGING_NAME" "$VERCEL_WEB_NAME"
    record_value "VERCEL_ADMIN_STAGING_NAME" "$VERCEL_ADMIN_NAME"
    record_value "VERCEL_LANDING_STAGING_NAME" "$VERCEL_LANDING_NAME"

    log_success "All 3 Vercel staging projects created and configured"
}

# --- Phase 3, Step 2: Convex Environment Variables ---

step_configure_convex_env() {
    log_step "Phase 3, Step 2: Convex Environment Variables"

    local site_url_value="${VERCEL_WEB_URL},${VERCEL_ADMIN_URL}"
    local admin_site_url_value="${VERCEL_ADMIN_URL}"
    local landing_url_value="${VERCEL_LANDING_URL}"

    echo ""
    echo "  Setting on the Convex staging project:"
    echo "    SITE_URL          = $site_url_value"
    echo "    ADMIN_SITE_URL    = $admin_site_url_value"
    echo "    LANDING_URL       = $landing_url_value"
    echo "    BETTER_AUTH_SECRET = (auto-generated)"
    echo ""

    # Check for existing values
    local existing_env
    existing_env=$(cd "$PROJECT_DIR/packages/backend" && \
        CONVEX_DEPLOY_KEY="$CONVEX_STAGING_DEPLOY_KEY" bunx convex env list 2>/dev/null || true)

    local has_existing=false
    if echo "$existing_env" | grep -q "SITE_URL" 2>/dev/null; then
        local existing_site_url
        existing_site_url=$(cd "$PROJECT_DIR/packages/backend" && \
            CONVEX_DEPLOY_KEY="$CONVEX_STAGING_DEPLOY_KEY" bunx convex env get SITE_URL 2>/dev/null || true)
        log_warn "SITE_URL already set: $existing_site_url"
        has_existing=true
    fi
    if echo "$existing_env" | grep -q "ADMIN_SITE_URL" 2>/dev/null; then
        local existing_admin_site_url
        existing_admin_site_url=$(cd "$PROJECT_DIR/packages/backend" && \
            CONVEX_DEPLOY_KEY="$CONVEX_STAGING_DEPLOY_KEY" bunx convex env get ADMIN_SITE_URL 2>/dev/null || true)
        log_warn "ADMIN_SITE_URL already set: $existing_admin_site_url"
        has_existing=true
    fi
    if echo "$existing_env" | grep -q "LANDING_URL" 2>/dev/null; then
        local existing_landing_url
        existing_landing_url=$(cd "$PROJECT_DIR/packages/backend" && \
            CONVEX_DEPLOY_KEY="$CONVEX_STAGING_DEPLOY_KEY" bunx convex env get LANDING_URL 2>/dev/null || true)
        log_warn "LANDING_URL already set: $existing_landing_url"
        has_existing=true
    fi
    if echo "$existing_env" | grep -q "BETTER_AUTH_SECRET" 2>/dev/null; then
        log_warn "BETTER_AUTH_SECRET already set"
        has_existing=true
    fi

    if [ "$has_existing" = true ]; then
        if ! ask_confirm "Overwrite existing Convex environment variables?"; then
            log_info "Keeping existing values"
            return
        fi
    else
        if ! ask_confirm "Set Convex environment variables?"; then
            log_warn "Skipped"
            return
        fi
    fi

    log_info "Setting SITE_URL..."
    (cd "$PROJECT_DIR/packages/backend" && \
        CONVEX_DEPLOY_KEY="$CONVEX_STAGING_DEPLOY_KEY" bunx convex env set SITE_URL "$site_url_value")
    log_success "SITE_URL set"

    log_info "Setting ADMIN_SITE_URL..."
    (cd "$PROJECT_DIR/packages/backend" && \
        CONVEX_DEPLOY_KEY="$CONVEX_STAGING_DEPLOY_KEY" bunx convex env set ADMIN_SITE_URL "$admin_site_url_value")
    log_success "ADMIN_SITE_URL set"

    log_info "Setting LANDING_URL..."
    (cd "$PROJECT_DIR/packages/backend" && \
        CONVEX_DEPLOY_KEY="$CONVEX_STAGING_DEPLOY_KEY" bunx convex env set LANDING_URL "$landing_url_value")
    log_success "LANDING_URL set"

    log_info "Generating and setting BETTER_AUTH_SECRET..."
    local auth_secret
    auth_secret=$(openssl rand -base64 32)
    (cd "$PROJECT_DIR/packages/backend" && \
        CONVEX_DEPLOY_KEY="$CONVEX_STAGING_DEPLOY_KEY" bunx convex env set BETTER_AUTH_SECRET "$auth_secret")
    log_success "BETTER_AUTH_SECRET set"

    record_value "CONVEX_SITE_URL_VALUE" "$site_url_value"
    record_value "CONVEX_ADMIN_SITE_URL_VALUE" "$admin_site_url_value"
    record_value "CONVEX_LANDING_URL_VALUE" "$landing_url_value"
    record_value "BETTER_AUTH_SECRET" "$auth_secret"

    log_success "Convex environment variables configured"
}

# --- Phase 3, Step 3: Vercel Environment Variables ---

# Set an environment variable on a Vercel project via CLI.
# Must be called from a directory containing .vercel/project.json.
# Usage: set_vercel_env "project-name" "VAR_NAME" "value"
set_vercel_env() {
    local project_name="$1"
    local key="$2"
    local value="$3"

    # vercel env add reads value from stdin; --force overwrites if exists
    if echo "$value" | vercel env add "$key" production \
        --token "$VERCEL_TOKEN" \
        --yes \
        --force 2>/dev/null; then
        log_info "  Set $key on $project_name"
    elif echo "$value" | vercel env add "$key" production \
        --token "$VERCEL_TOKEN" \
        --yes 2>/dev/null; then
        # --force may not be supported in older CLI versions; try without
        log_info "  Set $key on $project_name"
    else
        log_warn "  Could not set $key on $project_name (may need manual setup)"
    fi
}

step_configure_vercel_env() {
    log_step "Phase 3, Step 3: Vercel Environment Variables"
    echo ""
    echo "  Setting environment variables on each Vercel staging project."
    echo "  Uses the Vercel CLI with piped stdin (non-interactive)."
    echo ""
    echo -e "  ${BOLD}web-staging:${NC}"
    echo "    NEXT_PUBLIC_APP_ENVIRONMENT = staging"
    echo "    NEXT_PUBLIC_CONVEX_URL      = $CONVEX_STAGING_URL"
    echo "    NEXT_PUBLIC_CONVEX_SITE_URL = $CONVEX_STAGING_SITE_URL"
    echo "    NEXT_PUBLIC_SITE_URL        = $VERCEL_WEB_URL"
    echo "    NEXT_PUBLIC_LANDING_URL     = $VERCEL_LANDING_URL"
    echo ""
    echo -e "  ${BOLD}admin-staging:${NC}"
    echo "    NEXT_PUBLIC_APP_ENVIRONMENT = staging"
    echo "    NEXT_PUBLIC_CONVEX_URL      = $CONVEX_STAGING_URL"
    echo "    NEXT_PUBLIC_CONVEX_SITE_URL = $CONVEX_STAGING_SITE_URL"
    echo "    NEXT_PUBLIC_SITE_URL        = $VERCEL_ADMIN_URL"
    echo ""
    echo -e "  ${BOLD}landing-staging:${NC}"
    echo "    NEXT_PUBLIC_APP_ENVIRONMENT = staging"
    echo "    NEXT_PUBLIC_SITE_URL        = $VERCEL_LANDING_URL"
    echo "    NEXT_PUBLIC_WEB_APP_URL     = $VERCEL_WEB_URL"
    echo "    NEXT_PUBLIC_CONVEX_SITE_URL = $CONVEX_STAGING_SITE_URL"
    echo ""

    # Check for existing env vars on each project
    local has_existing=false
    for check_project_id in "$VERCEL_PROJECT_WEB_STAGING_ID" "$VERCEL_PROJECT_ADMIN_STAGING_ID" "$VERCEL_PROJECT_LANDING_STAGING_ID"; do
        local env_count
        env_count=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
            "https://api.vercel.com/v10/projects/${check_project_id}/env" \
            | jq '.envs | length' 2>/dev/null || echo "0")
        if [ "$env_count" -gt 0 ] 2>/dev/null; then
            has_existing=true
            break
        fi
    done

    if [ "$has_existing" = true ]; then
        log_warn "Some Vercel projects already have environment variables set"
        if ! ask_confirm "Overwrite existing Vercel environment variables?"; then
            log_info "Keeping existing values"
            return
        fi
    else
        if ! ask_confirm "Set Vercel environment variables?"; then
            log_warn "Skipped"
            return
        fi
    fi

    # The vercel CLI needs .vercel/project.json to know which project to target.
    # We create a temp dir and swap the project.json for each project.
    TMPDIR_VERCEL=$(mktemp -d)
    mkdir -p "$TMPDIR_VERCEL/.vercel"

    log_info "Setting web-staging env vars..."
    echo "{\"orgId\":\"$VERCEL_ORG_ID\",\"projectId\":\"$VERCEL_PROJECT_WEB_STAGING_ID\"}" \
        > "$TMPDIR_VERCEL/.vercel/project.json"
    (cd "$TMPDIR_VERCEL" && set_vercel_env "$VERCEL_WEB_NAME" "NEXT_PUBLIC_APP_ENVIRONMENT" "staging")
    (cd "$TMPDIR_VERCEL" && set_vercel_env "$VERCEL_WEB_NAME" "NEXT_PUBLIC_CONVEX_URL" "$CONVEX_STAGING_URL")
    (cd "$TMPDIR_VERCEL" && set_vercel_env "$VERCEL_WEB_NAME" "NEXT_PUBLIC_CONVEX_SITE_URL" "$CONVEX_STAGING_SITE_URL")
    (cd "$TMPDIR_VERCEL" && set_vercel_env "$VERCEL_WEB_NAME" "NEXT_PUBLIC_SITE_URL" "$VERCEL_WEB_URL")
    (cd "$TMPDIR_VERCEL" && set_vercel_env "$VERCEL_WEB_NAME" "NEXT_PUBLIC_LANDING_URL" "$VERCEL_LANDING_URL")

    log_info "Setting admin-staging env vars..."
    echo "{\"orgId\":\"$VERCEL_ORG_ID\",\"projectId\":\"$VERCEL_PROJECT_ADMIN_STAGING_ID\"}" \
        > "$TMPDIR_VERCEL/.vercel/project.json"
    (cd "$TMPDIR_VERCEL" && set_vercel_env "$VERCEL_ADMIN_NAME" "NEXT_PUBLIC_APP_ENVIRONMENT" "staging")
    (cd "$TMPDIR_VERCEL" && set_vercel_env "$VERCEL_ADMIN_NAME" "NEXT_PUBLIC_CONVEX_URL" "$CONVEX_STAGING_URL")
    (cd "$TMPDIR_VERCEL" && set_vercel_env "$VERCEL_ADMIN_NAME" "NEXT_PUBLIC_CONVEX_SITE_URL" "$CONVEX_STAGING_SITE_URL")
    (cd "$TMPDIR_VERCEL" && set_vercel_env "$VERCEL_ADMIN_NAME" "NEXT_PUBLIC_SITE_URL" "$VERCEL_ADMIN_URL")

    log_info "Setting landing-staging env vars..."
    echo "{\"orgId\":\"$VERCEL_ORG_ID\",\"projectId\":\"$VERCEL_PROJECT_LANDING_STAGING_ID\"}" \
        > "$TMPDIR_VERCEL/.vercel/project.json"
    (cd "$TMPDIR_VERCEL" && set_vercel_env "$VERCEL_LANDING_NAME" "NEXT_PUBLIC_APP_ENVIRONMENT" "staging")
    (cd "$TMPDIR_VERCEL" && set_vercel_env "$VERCEL_LANDING_NAME" "NEXT_PUBLIC_SITE_URL" "$VERCEL_LANDING_URL")
    (cd "$TMPDIR_VERCEL" && set_vercel_env "$VERCEL_LANDING_NAME" "NEXT_PUBLIC_WEB_APP_URL" "$VERCEL_WEB_URL")
    (cd "$TMPDIR_VERCEL" && set_vercel_env "$VERCEL_LANDING_NAME" "NEXT_PUBLIC_CONVEX_SITE_URL" "$CONVEX_STAGING_SITE_URL")

    # Clean up temp dir
    rm -rf "$TMPDIR_VERCEL"
    TMPDIR_VERCEL=""

    record_value "VERCEL_ENV_VARS_SET" "true"
    log_success "Vercel environment variables configured on all 3 projects"
}

# --- Phase 3, Step 4: GitHub Configuration ---

# Helper: set all repository secrets
set_github_secrets() {
    gh secret set VERCEL_TOKEN \
        --body "$VERCEL_TOKEN" \
        --repo "$GITHUB_REPO"
    log_info "  Set VERCEL_TOKEN"

    gh secret set VERCEL_ORG_ID \
        --body "$VERCEL_ORG_ID" \
        --repo "$GITHUB_REPO"
    log_info "  Set VERCEL_ORG_ID"

    gh secret set VERCEL_PROJECT_ID_WEB_STAGING \
        --body "$VERCEL_PROJECT_WEB_STAGING_ID" \
        --repo "$GITHUB_REPO"
    log_info "  Set VERCEL_PROJECT_ID_WEB_STAGING"

    gh secret set VERCEL_PROJECT_ID_ADMIN_STAGING \
        --body "$VERCEL_PROJECT_ADMIN_STAGING_ID" \
        --repo "$GITHUB_REPO"
    log_info "  Set VERCEL_PROJECT_ID_ADMIN_STAGING"

    gh secret set VERCEL_PROJECT_ID_LANDING_STAGING \
        --body "$VERCEL_PROJECT_LANDING_STAGING_ID" \
        --repo "$GITHUB_REPO"
    log_info "  Set VERCEL_PROJECT_ID_LANDING_STAGING"

    log_success "Repository secrets set"
}

# Helper: set branch protection on main
set_branch_protection() {
    if gh api "repos/${GITHUB_REPO}/branches/main/protection" \
        -X PUT \
        -H "Accept: application/vnd.github+json" \
        --input - <<'EOF' >/dev/null 2>&1; then
{
    "required_status_checks": {
        "strict": true,
        "contexts": [
            "CI Shared Complete",
            "CI Web Complete",
            "CI Admin Complete",
            "CI Landing Complete"
        ]
    },
    "enforce_admins": false,
    "required_pull_request_reviews": {
        "required_approving_review_count": 0
    },
    "restrictions": null
}
EOF
        log_success "Branch protection configured"
    else
        log_warn "Could not set branch protection (may require a paid plan for private repos)"
    fi
}

step_configure_github() {
    log_step "Phase 3, Step 4: GitHub Configuration"
    echo ""
    echo "  This will:"
    echo "    - Create a 'staging' environment (deployment branch: main)"
    echo "    - Set repository secrets: VERCEL_TOKEN, VERCEL_ORG_ID, 3 project IDs"
    echo "    - Set staging environment secret: CONVEX_DEPLOY_KEY"
    echo "    - Configure branch protection on main"
    echo ""

    if ! ask_confirm "Configure GitHub?"; then
        log_warn "Skipped"
        return
    fi

    # --- Staging environment ---
    local env_exists=false
    if gh api "repos/${GITHUB_REPO}/environments/staging" >/dev/null 2>&1; then
        env_exists=true
        log_warn "GitHub 'staging' environment already exists"
        if ! ask_confirm "Overwrite staging environment settings?"; then
            log_info "Keeping existing environment"
        else
            gh api "repos/${GITHUB_REPO}/environments/staging" \
                -X PUT \
                -H "Accept: application/vnd.github+json" \
                --input - <<'EOF' >/dev/null 2>&1 || true
{
    "deployment_branch_policy": {
        "protected_branches": false,
        "custom_branch_policies": true
    }
}
EOF
            log_success "Staging environment updated"

            gh api "repos/${GITHUB_REPO}/environments/staging/deployment-branch-policies" \
                -X POST \
                --input - <<'EOF' >/dev/null 2>&1 || true
{
    "name": "main",
    "type": "branch"
}
EOF
            log_success "Deployment branch policy set"
        fi
    else
        log_info "Creating 'staging' environment..."
        gh api "repos/${GITHUB_REPO}/environments/staging" \
            -X PUT \
            -H "Accept: application/vnd.github+json" \
            --input - <<'EOF' >/dev/null 2>&1 || true
{
    "deployment_branch_policy": {
        "protected_branches": false,
        "custom_branch_policies": true
    }
}
EOF
        log_success "Staging environment created"

        log_info "Setting deployment branch policy to main..."
        gh api "repos/${GITHUB_REPO}/environments/staging/deployment-branch-policies" \
            -X POST \
            --input - <<'EOF' >/dev/null 2>&1 || true
{
    "name": "main",
    "type": "branch"
}
EOF
        log_success "Deployment branch policy set"
    fi

    # --- Repository secrets ---
    local existing_secrets
    existing_secrets=$(gh secret list --repo "$GITHUB_REPO" 2>/dev/null || true)
    local secrets_exist=false
    if echo "$existing_secrets" | grep -q "VERCEL_TOKEN" 2>/dev/null; then
        secrets_exist=true
    fi

    if [ "$secrets_exist" = true ]; then
        log_warn "Repository secrets already exist:"
        echo "$existing_secrets" | grep -E "VERCEL_|CONVEX_" | while read -r line; do
            echo "    $line"
        done
        if ! ask_confirm "Overwrite existing repository secrets?"; then
            log_info "Keeping existing secrets"
        else
            set_github_secrets
        fi
    else
        log_info "Setting repository secrets..."
        set_github_secrets
    fi

    # --- Environment secret ---
    local existing_env_secrets
    existing_env_secrets=$(gh secret list --env staging --repo "$GITHUB_REPO" 2>/dev/null || true)

    if echo "$existing_env_secrets" | grep -q "CONVEX_DEPLOY_KEY" 2>/dev/null; then
        log_warn "Staging environment secret CONVEX_DEPLOY_KEY already exists"
        if ! ask_confirm "Overwrite CONVEX_DEPLOY_KEY?"; then
            log_info "Keeping existing environment secret"
        else
            gh secret set CONVEX_DEPLOY_KEY \
                --body "$CONVEX_STAGING_DEPLOY_KEY" \
                --env staging \
                --repo "$GITHUB_REPO"
            log_success "CONVEX_DEPLOY_KEY updated"
        fi
    else
        log_info "Setting staging environment secret..."
        gh secret set CONVEX_DEPLOY_KEY \
            --body "$CONVEX_STAGING_DEPLOY_KEY" \
            --env staging \
            --repo "$GITHUB_REPO"
        log_success "CONVEX_DEPLOY_KEY set"
    fi

    # --- Branch protection ---
    local protection_exists=false
    if gh api "repos/${GITHUB_REPO}/branches/main/protection" >/dev/null 2>&1; then
        protection_exists=true
        log_warn "Branch protection already configured on main"
        local existing_checks
        existing_checks=$(gh api "repos/${GITHUB_REPO}/branches/main/protection" \
            --jq '.required_status_checks.contexts[]' 2>/dev/null || true)
        if [ -n "$existing_checks" ]; then
            echo "    Required checks:"
            echo "$existing_checks" | while read -r check; do
                echo "      - $check"
            done
        fi
        if ! ask_confirm "Overwrite branch protection?"; then
            log_info "Keeping existing branch protection"
        else
            set_branch_protection
        fi
    else
        log_info "Configuring branch protection on main..."
        set_branch_protection
    fi

    record_value "GITHUB_STAGING_ENV_CREATED" "true"
    record_value "GITHUB_SECRETS_SET" "true"
    record_value "GITHUB_BRANCH_PROTECTION_SET" "true"

    log_success "GitHub configuration complete"
}

# --- Phase 3, Step 5: Optional Deploy & Bootstrap ---

step_optional_bootstrap() {
    log_step "Phase 3, Step 5 (Optional): Deploy & Bootstrap"
    echo ""
    echo "  This will:"
    echo "    1. Deploy Convex functions to the staging project"
    echo "    2. Create the first admin user via bootstrap:initialize"
    echo ""
    echo "  You can skip this and do it later via the CD pipeline."
    echo ""

    if ! ask_confirm "Deploy Convex and bootstrap staging now?"; then
        log_info "Skipped. To deploy later, push to main or run manually."
        return
    fi

    log_info "Deploying Convex functions to staging..."
    (cd "$PROJECT_DIR/packages/backend" && \
        CONVEX_DEPLOY_KEY="$CONVEX_STAGING_DEPLOY_KEY" bunx convex deploy --cmd 'echo "skip"')
    log_success "Convex deployed to staging"

    echo ""
    if ask_confirm "Bootstrap the first admin user?"; then
        local admin_email
        admin_email=$(ask_input "Admin email address" "")

        log_info "Running bootstrap:initialize..."
        local json_arg
        json_arg=$(jq -n --arg email "$admin_email" '{"email": $email}')
        (cd "$PROJECT_DIR/packages/backend" && \
            CONVEX_DEPLOY_KEY="$CONVEX_STAGING_DEPLOY_KEY" \
            bunx convex run bootstrap:initialize "$json_arg")

        record_value "BOOTSTRAP_EMAIL" "$admin_email"
        record_value "BOOTSTRAP_COMPLETE" "true"
        log_success "Bootstrap complete — check your email for the invitation"
    fi
}

# ============================================================
# VERIFICATION
# ============================================================

print_verification() {
    log_step "Verification"
    echo ""
    echo "  Run these commands to verify the setup:"
    echo ""
    echo -e "  ${BOLD}# Convex env vars${NC}"
    echo "  CONVEX_DEPLOY_KEY='${CONVEX_STAGING_DEPLOY_KEY:0:12}...' \\"
    echo "    bunx convex env list"
    echo ""
    echo -e "  ${BOLD}# GitHub secrets${NC}"
    echo "  gh secret list --repo $GITHUB_REPO"
    echo "  gh secret list --env staging --repo $GITHUB_REPO"
    echo ""
    echo -e "  ${BOLD}# GitHub branch protection${NC}"
    echo "  gh api repos/${GITHUB_REPO}/branches/main/protection \\"
    echo "    --jq '.required_status_checks.contexts[]'"
    echo ""
    echo -e "  ${BOLD}# Vercel projects${NC}"
    echo "  vercel project ls"
    echo ""
}

# ============================================================
# FINAL SUMMARY
# ============================================================

print_final_summary() {
    log_step "Setup Complete"
    echo ""
    echo -e "  ${BOLD}Output files:${NC}"
    echo "    Record: $RECORD_FILE"
    echo "    Log:    $LOG_FILE"
    echo ""
    echo -e "  ${BOLD}What's next:${NC}"
    echo "    1. Push to main (or merge a PR) to trigger the first staging deployment"
    echo "    2. Monitor: gh run list --workflow=cd-staging.yml --limit 1"
    echo "    3. Validate staging apps at:"
    echo "       - $VERCEL_WEB_URL"
    echo "       - $VERCEL_ADMIN_URL"
    echo "       - $VERCEL_LANDING_URL"
    echo ""
    echo "  See docs/deployment-runbook.md for the full deployment workflow."
    echo ""
}

# ============================================================
# MAIN
# ============================================================

main() {
    # Capture all console output to the log file (plain ASCII) while still
    # showing colored/Unicode output on screen. tee writes to both:
    #   - stdout (terminal, with colors and Unicode symbols)
    #   - process substitution (perl converts to plain ASCII, writes to log file)
    #
    # The perl process uses chunk-based sysread (not line-based -pe) so that
    # no-newline prompts like "  GitHub repo: " get flushed to the log file
    # immediately. This ensures direct >> writes for user input appear after
    # the prompt, not before it. Raw byte matching for UTF-8 sequences.
    exec > >(tee >(perl -e '
        $| = 1;
        while (sysread(STDIN, $buf, 4096)) {
            $buf =~ s/\e\[[0-9;]*m//g;
            $buf =~ s/\xe2\x84\xb9/[i]/g;
            $buf =~ s/\xe2\x9c\x93/[ok]/g;
            $buf =~ s/\xe2\x9c\x97/[FAIL]/g;
            $buf =~ s/\xe2\x9a\xa0/[!]/g;
            $buf =~ s/\xe2\x94\x81/=/g;
            print $buf;
        }
    ' >> "$LOG_FILE")) 2>&1

    echo ""
    echo -e "${BOLD}  Staging Infrastructure Setup${NC}"
    echo -e "${DIM}  Based on docs/deployment-runbook.md${NC}"
    echo ""
    log_info "Session log: $LOG_FILE"
    log_info "Record file: $RECORD_FILE"
    echo ""

    # Initialize record file
    local generated_ts
    generated_ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    echo "# Staging Setup Record" > "$RECORD_FILE"
    chmod 600 "$RECORD_FILE"
    echo "# Generated: $generated_ts" >> "$RECORD_FILE"
    echo "# ===========================================" >> "$RECORD_FILE"
    echo "" >> "$RECORD_FILE"

    # Initialize log file with matching header
    echo "# Staging Setup Session Log" > "$LOG_FILE"
    chmod 600 "$LOG_FILE"
    echo "# Generated: $generated_ts" >> "$LOG_FILE"
    echo "# ===========================================" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"

    # Phase 0: Prerequisites
    check_prerequisites

    # Phase 1: Collect
    collect_inputs

    # Record collected values
    record_value "PROJECT_PREFIX" "$PROJECT_PREFIX"
    record_value "GITHUB_REPO" "$GITHUB_REPO"
    record_value "CONVEX_STAGING_URL" "$CONVEX_STAGING_URL"
    record_value "CONVEX_STAGING_SITE_URL" "$CONVEX_STAGING_SITE_URL"
    record_value "CONVEX_STAGING_DEPLOY_KEY" "$CONVEX_STAGING_DEPLOY_KEY"
    record_value "VERCEL_ORG_ID" "$VERCEL_ORG_ID"

    # Phase 2: Confirm
    print_summary
    if ! ask_confirm "Proceed with staging setup?"; then
        echo ""
        log_info "Aborted. Record file saved to: $RECORD_FILE"
        exit 0
    fi

    # Phase 3: Execute
    step_create_vercel_projects
    step_configure_convex_env
    step_configure_vercel_env
    step_configure_github
    step_optional_bootstrap

    # Done
    print_verification
    print_final_summary

    sleep 0.1  # let tee flush final output to log
}

main "$@"
