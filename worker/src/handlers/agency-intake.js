// src/handlers/agency-intake.js
// POST /agency/intake
//
// "Cold-URL" entry point. Used when a prospect lands on the onboarding form
// without a ?cid= param (e.g., the agency owner shared the URL verbally, or a contact
// hit the page before being added to GHL).
//
// Takes minimal identifying info, upserts a contact in the agency GHL
// sub-account, and returns the resulting contact ID. The form then proceeds
// into the normal 25-field flow using that ID.
//
// Required: firstName, lastName, email
// Optional: phone, companyName
//
// Idempotency: GHL's /contacts/upsert endpoint is idempotent on email match
// inside the same locationId — submitting the same email twice updates the
// existing contact rather than creating a duplicate.

import { corsHeaders } from "../cors.js";
import { upsertContact } from "../ghl.js";

// Simple email shape validation — full RFC 5322 is overkill for this entry point.
function looksLikeEmail(s) {
  if (typeof s !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export async function handleAgencyIntake(request, env) {
  const baseHeaders = { ...corsHeaders(request), "Content-Type": "application/json" };

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: baseHeaders }
    );
  }

  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || "").trim();
  const companyName = (body.companyName || "").trim();

  // ── Validate required fields ─────────────────────────────────────────────────
  if (!firstName) {
    return new Response(
      JSON.stringify({ error: "First name is required" }),
      { status: 400, headers: baseHeaders }
    );
  }
  if (!lastName) {
    return new Response(
      JSON.stringify({ error: "Last name is required" }),
      { status: 400, headers: baseHeaders }
    );
  }
  if (!looksLikeEmail(email)) {
    return new Response(
      JSON.stringify({ error: "A valid email is required" }),
      { status: 400, headers: baseHeaders }
    );
  }

  // ── Load agency config ───────────────────────────────────────────────────────
  const agencyConfig = await env.CLIENTS.get("__agency", { type: "json" });
  if (!agencyConfig) {
    console.error("[agency-intake] __agency KV entry not found");
    return new Response(
      JSON.stringify({ error: "Agency not configured" }),
      { status: 500, headers: baseHeaders }
    );
  }

  // ── Origin check ─────────────────────────────────────────────────────────────
  if (agencyConfig.allowedOrigins && agencyConfig.allowedOrigins.length > 0) {
    const origin = request.headers.get("Origin") || "";
    if (origin && !agencyConfig.allowedOrigins.includes(origin)) {
      console.log(`[agency-intake] Origin rejected: ${origin}`);
      return new Response(
        JSON.stringify({ error: "Origin not allowed" }),
        { status: 403, headers: baseHeaders }
      );
    }
  }

  // ── Upsert in GHL ────────────────────────────────────────────────────────────
  let result;
  try {
    result = await upsertContact({
      pit:         agencyConfig.pit,
      locationId:  agencyConfig.locationId,
      firstName,
      lastName,
      email,
      phone:       phone || undefined,
      companyName: companyName || undefined,
      // Tag so the agency owner can spot "walk-up" intakes vs. ones he initiated.
      tags: ["cold-intake"],
    });
  } catch (err) {
    console.error("[agency-intake] GHL upsert failed:", err.message);
    return new Response(
      JSON.stringify({ error: "Contact creation failed", detail: err.message }),
      { status: 502, headers: baseHeaders }
    );
  }

  const cid = result?.contact?.id || result?.id;
  if (!cid) {
    console.error("[agency-intake] Upsert succeeded but no contact ID returned:", result);
    return new Response(
      JSON.stringify({ error: "No contact ID returned from GHL" }),
      { status: 502, headers: baseHeaders }
    );
  }

  const isNew = Boolean(result?.new);
  console.log(
    `[agency-intake] ${isNew ? "✓ Created" : "↺ Matched existing"} contact ${cid} for ${email}`
  );

  return new Response(
    JSON.stringify({ ok: true, cid, isNew }),
    { status: 200, headers: baseHeaders }
  );
}
