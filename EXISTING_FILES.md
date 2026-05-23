# What's Not In This Repo

This repo contains the **agency-onboarding additions** for a Cloudflare Worker. To make it a complete, deployable system you'll need a few baseline files this repo doesn't ship:

| Missing | What it is | How to get it |
|---|---|---|
| `worker/wrangler.toml` | Cloudflare Worker config (name, KV binding) | See `wrangler.toml.example` notes in `worker/README.md` (or run `wrangler init` and adapt) |
| `worker/src/index.js` (full) | The repo's `src/index.js` is the **router only** — it imports a `submit.js` + `health.js` handler stub. If you don't need those existing routes, delete the imports. | Edit `src/index.js` to remove or replace the references |
| `worker/src/ghl.js` (base) | The repo ships `src/ghl-additions.js`. You'll need a base `ghl.js` defining `GHL_BASE`, `headers()`, and any existing helpers. | A minimal version is 5–10 lines; see `worker/README.md` for a starter |
| `worker/src/cors.js` | CORS helper exporting `corsHeaders(request)` and `handlePreflight(request)` | Provide your own; standard Cloudflare Worker CORS helper |
| `package.json` | NPM scaffolding (wrangler dev dependency) | `npm init -y && npm install --save-dev wrangler` |

## Why this split exists

This system was originally built as an additive layer on top of an existing Cloudflare Worker that did unrelated lead-capture work. The repo contains only the parts you'd reuse: the onboarding routes, the form, the GHL workflow guides, and the deploy pattern.

If you're starting from scratch, the easiest path is:
1. `npm init -y && npm install --save-dev wrangler`
2. `npx wrangler init` to scaffold a basic worker
3. Drop these files into the right places (see repo tour in README)
4. Implement the 5 minimal missing pieces above
5. Deploy and wire up the form + GHL workflows
