#!/usr/bin/env bash
# deploy-cold-url.sh
#
# Set REPO_SRC to override the location of the source files.
# Defaults to ./worker/src/ relative to this script.
# One-command deploy for the cold-URL support added May 22, 2026.
# Run this from anywhere — no need to cd first.
#
# It will:
#   1. Verify ~/Downloads/leads-proxy/ exists
#   2. Back up the current src/ directory (timestamped, kept locally)
#   3. Copy the new agency-intake.js handler into place
#   4. Append the upsertContact() helper to src/ghl.js (idempotent — skips if already added)
#   5. Replace src/index.js with the version that registers the new route
#   6. Run `npx wrangler deploy`
#   7. Print the new version ID at the end
#
# It will NOT:
#   - Touch KV config (no config changes this session)
#   - Modify wrangler.toml
#   - Delete anything

set -euo pipefail

# ── Paths ───────────────────────────────────────────────────────────────────
WORKER_DIR="$HOME/Downloads/leads-proxy"
REPO_SRC="${REPO_SRC:-$(cd "$(dirname "$0")/.." && pwd)/worker/src}"

# ── Colors ──────────────────────────────────────────────────────────────────
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

step()  { echo ""; echo "${BLUE}━━ $1 ━━${NC}"; }
ok()    { echo "${GREEN}✓${NC} $1"; }
warn()  { echo "${YELLOW}⚠${NC}  $1"; }
fail()  { echo "${RED}✗${NC} $1"; exit 1; }

# ── 0. Sanity checks ────────────────────────────────────────────────────────
step "Pre-flight"

[[ -d "$WORKER_DIR" ]]                || fail "Worker dir not found: $WORKER_DIR"
[[ -f "$WORKER_DIR/wrangler.toml" ]]  || fail "wrangler.toml missing in $WORKER_DIR — wrong folder?"
[[ -f "$WORKER_DIR/src/index.js" ]]   || fail "src/index.js missing in $WORKER_DIR"
[[ -f "$WORKER_DIR/src/ghl.js" ]]     || fail "src/ghl.js missing in $WORKER_DIR"

[[ -f "$REPO_SRC/handlers/agency-intake.js" ]] || fail "Source handler missing: $REPO_SRC/handlers/agency-intake.js"
[[ -f "$REPO_SRC/ghl-additions.js" ]]          || fail "ghl-additions.js missing"
[[ -f "$REPO_SRC/index-updated.js" ]]          || fail "index-updated.js missing"

ok "Worker dir found: $WORKER_DIR"
ok "Source files found in repo folder"

# ── 1. Backup ───────────────────────────────────────────────────────────────
step "Backup"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$WORKER_DIR/.backups/pre-cold-url-$TIMESTAMP"
mkdir -p "$BACKUP_DIR"
cp -R "$WORKER_DIR/src" "$BACKUP_DIR/src"
ok "Backed up src/ to $BACKUP_DIR/src"

# ── 2. Copy new handler ─────────────────────────────────────────────────────
step "Copy new handler"

cp "$REPO_SRC/handlers/agency-intake.js" "$WORKER_DIR/src/handlers/agency-intake.js"
ok "Copied agency-intake.js → src/handlers/"

# ── 3. Append upsertContact to ghl.js (idempotent) ──────────────────────────
step "Append upsertContact() to ghl.js"

if grep -q "export async function upsertContact" "$WORKER_DIR/src/ghl.js"; then
  warn "upsertContact already present in ghl.js — skipping append"
else
  # Extract just the upsertContact block (everything from the marker header onward)
  # The block in ghl-additions.js starts with "// upsertContact —"
  if grep -qn "^// upsertContact" "$REPO_SRC/ghl-additions.js"; then
    UPSERT_START=$(grep -n "^// upsertContact" "$REPO_SRC/ghl-additions.js" | head -1 | cut -d: -f1)
    # The block starts one line before with the "// ---..." header line
    HEADER_START=$((UPSERT_START - 1))
    # Append from header to end of file
    echo "" >> "$WORKER_DIR/src/ghl.js"
    tail -n +"$HEADER_START" "$REPO_SRC/ghl-additions.js" >> "$WORKER_DIR/src/ghl.js"
    ok "Appended upsertContact block to ghl.js"
  else
    fail "Could not find '// upsertContact' marker in $REPO_SRC/ghl-additions.js"
  fi
fi

# ── 4. Replace index.js ─────────────────────────────────────────────────────
step "Update router"

cp "$REPO_SRC/index-updated.js" "$WORKER_DIR/src/index.js"
ok "Replaced src/index.js with updated router"

# ── 5. Syntax check before deploy ───────────────────────────────────────────
step "Syntax check"

cd "$WORKER_DIR"
for f in src/index.js src/ghl.js src/handlers/agency-intake.js; do
  if node --check "$f" 2>/dev/null; then
    ok "$f"
  else
    fail "Syntax error in $f — restore from $BACKUP_DIR/src/ and retry"
  fi
done

# ── 6. Deploy ───────────────────────────────────────────────────────────────
step "Deploy via wrangler"

echo "Running: npx wrangler deploy"
echo ""

# Capture deploy output so we can extract the version ID
DEPLOY_OUTPUT=$(npx wrangler deploy 2>&1)
echo "$DEPLOY_OUTPUT"

# ── 7. Report ───────────────────────────────────────────────────────────────
step "Done"

NEW_VERSION=$(echo "$DEPLOY_OUTPUT" | grep -Eo 'Current Version ID: [a-f0-9-]+' | head -1 | awk '{print $NF}')

if [[ -n "${NEW_VERSION:-}" ]]; then
  ok "Deploy succeeded"
  echo ""
  echo "${GREEN}New version ID:${NC} $NEW_VERSION"
  echo ""
  echo "Tell Claude: 'deployed $NEW_VERSION' so it can update memory and smoke-test."
else
  warn "Deploy ran but couldn't extract version ID — check output above"
fi

echo ""
echo "Rollback (if needed): cd $WORKER_DIR && npx wrangler rollback"
echo "Or restore old files:  cp -R $BACKUP_DIR/src/* $WORKER_DIR/src/ && npx wrangler deploy"
