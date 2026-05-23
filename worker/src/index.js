// src/index.js — REPLACE your existing index.js with this version
// Adds two new agency routes while leaving the existing /submit and /health routes unchanged.

import { handleSubmit }          from "./handlers/submit.js";
import { handleHealth }          from "./handlers/health.js";
import { handleAgencyContact }   from "./handlers/agency-contact.js";
import { handleAgencyOnboarding } from "./handlers/agency-onboarding.js";
import { handleAgencyIntake }    from "./handlers/agency-intake.js";
import { corsHeaders, handlePreflight } from "./cors.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight (handles all routes)
    if (request.method === "OPTIONS") {
      return handlePreflight(request);
    }

    // ── Existing routes ──────────────────────────────────────────────────────

    if (url.pathname === "/health" && request.method === "GET") {
      return handleHealth(request, env);
    }

    if (url.pathname === "/submit" && request.method === "POST") {
      return handleSubmit(request, env, ctx);
    }

    // ── Agency onboarding routes ─────────────────────────────────────────────

    // GET /agency/contact?cid=CONTACT_ID
    // Called by the onboarding form on load to pre-fill data from GHL.
    if (url.pathname === "/agency/contact" && request.method === "GET") {
      return handleAgencyContact(request, env);
    }

    // POST /agency/onboarding
    // Called by the onboarding form on submit to write answers back to GHL.
    if (url.pathname === "/agency/onboarding" && request.method === "POST") {
      return handleAgencyOnboarding(request, env);
    }

    // POST /agency/intake
    // "Cold-URL" entry — called by the onboarding form when no ?cid= is present.
    // Takes name + email (+ optional phone/company), upserts a GHL contact,
    // returns the contact ID so the form can proceed normally.
    if (url.pathname === "/agency/intake" && request.method === "POST") {
      return handleAgencyIntake(request, env);
    }

    // ── 404 fallback ─────────────────────────────────────────────────────────

    return new Response(
      JSON.stringify({ error: "Not found" }),
      {
        status: 404,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      }
    );
  },
};
