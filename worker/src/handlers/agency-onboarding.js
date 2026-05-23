// src/handlers/agency-onboarding.js
// POST /agency/onboarding
//
// Receives the completed onboarding form payload, updates the GHL contact,
// and adds the "onboarding-complete" tag.
//
// FALLBACK STRATEGY (for when custom field keys are not yet configured):
//   1. Standard fields (name, email, phone, etc.) + tag — always attempted first
//   2. Custom fields — only written if real refs exist in the mapping (placeholders skipped)
//   3. If zero custom fields had real refs, the full submission is stored as a
//      contact note so no data is lost
//   4. Full summary is always logged to Cloudflare dashboard as a last resort

import { corsHeaders } from "../cors.js";
import { updateContact } from "../ghl.js";

// Values that haven't been replaced yet — treat as "not configured"
const PLACEHOLDER_PATTERNS = ["REPLACE_WITH", "CHECK_MANUALLY", "SKIPPED", "MISSING", "VERIFY"];
function isRealFieldRef(ref) {
  if (!ref || typeof ref !== "string") return false;
  const upper = ref.toUpperCase();
  return !PLACEHOLDER_PATTERNS.some(p => upper.includes(p));
}

// Build a single customField entry for the GHL API.
// GHL v2 accepts two formats:
//   UUID-based:  { id: "abc123...",              value: "..."        }
//   Key-based:   { key: "contact.field_name",    field_value: "..." }
// A mapping value is treated as a key if it starts with "contact."
function buildFieldEntry(ref, value) {
  if (ref.startsWith("contact.")) {
    return { key: ref, field_value: String(value) };
  }
  return { id: ref, value: String(value) };
}

// POST a note to a GHL contact
async function createContactNote({ pit, contactId, body: noteBody }) {
  const resp = await fetch(
    `https://services.leadconnectorhq.com/contacts/${contactId}/notes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pit}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: noteBody }),
    }
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GHL POST note ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

// Format all form data as readable plain text
function buildSummary(body) {
  const lines = [
    `=== ONBOARDING SUBMISSION ===`,
    `Submitted: ${new Date().toISOString()}`,
    ``,
    `--- BUSINESS BASICS ---`,
    `Company:     ${body.companyName || "—"}`,
    `Contact:     ${body.firstName || ""} ${body.lastName || ""}`.trim() || "—",
    `Email:       ${body.email || "—"}`,
    `Phone:       ${body.phone || "—"}`,
    `Address:     ${[body.address1, body.city, body.state, body.postalCode].filter(Boolean).join(", ") || "—"}`,
    ``,
    `--- CUSTOM FIELDS ---`,
  ];

  const cf = body.customFields || {};
  const labels = {
    ein:                "EIN",
    legal_name:         "Legal Business Name",
    service_area:       "Service Area",
    domain_first:       "Domain (Primary)",
    domain_second:      "Domain (Alternate)",
    services_offered:   "Services Offered",
    lead_magnet:        "Lead Magnet / Offer",
    business_hours_days: "Business Hours — Days",
    business_hours_start: "Business Hours — Open",
    business_hours_end:  "Business Hours — Close",
    emergency_service:  "Emergency / After-hours",
    logo_url:           "Logo URL",
    brand_color_primary: "Brand Color (Primary)",
    brand_color_accent:  "Brand Color (Accent)",
    tone:               "Brand Tone",
    differentiator:     "Key Differentiator",
    facebook_url:       "Facebook Page URL",
    gmb_status:         "GMB Status",
    reviews_url:        "Review / GMB URL",
    online_notes:       "Notes — Online Presence",
    has_customer_list:  "Has Customer List?",
    customer_notes:     "Notes — Customer List",
    site_notes:         "Notes — Site Requests",
    client_questions:   "Client Questions",
    onboarding_status:  "Onboarding Status",
  };

  for (const [key, label] of Object.entries(labels)) {
    const val = cf[key];
    if (val != null && val !== "") {
      lines.push(`${label}: ${val}`);
    }
  }

  return lines.join("\n");
}

export async function handleAgencyOnboarding(request, env) {
  const baseHeaders = { ...corsHeaders(request), "Content-Type": "application/json" };

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: baseHeaders });
  }

  const { cid } = body;
  if (!cid) {
    return new Response(JSON.stringify({ error: "Missing required field: cid" }), { status: 400, headers: baseHeaders });
  }

  // ── Load agency config ───────────────────────────────────────────────────────
  const agencyConfig = await env.CLIENTS.get("__agency", { type: "json" });
  if (!agencyConfig) {
    console.error("[agency-onboarding] __agency KV entry not found");
    return new Response(JSON.stringify({ error: "Agency not configured" }), { status: 500, headers: baseHeaders });
  }

  // ── Origin check ─────────────────────────────────────────────────────────────
  if (agencyConfig.allowedOrigins && agencyConfig.allowedOrigins.length > 0) {
    const origin = request.headers.get("Origin") || "";
    if (origin && !agencyConfig.allowedOrigins.includes(origin)) {
      console.log(`[agency-onboarding] Origin rejected: ${origin}`);
      return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers: baseHeaders });
    }
  }

  // ── Build full summary (logged regardless of what else happens) ──────────────
  const summary = buildSummary(body);
  console.log(`[agency-onboarding] Submission for cid=${cid}\n${summary}`);

  // ── Filter custom fields — skip placeholders ─────────────────────────────────
  const customFieldMapping = agencyConfig.customFieldMapping || {};
  const customFieldsArray = [];
  for (const [name, value] of Object.entries(body.customFields || {})) {
    const fieldRef = customFieldMapping[name];
    if (isRealFieldRef(fieldRef) && value != null && value !== "") {
      customFieldsArray.push(buildFieldEntry(fieldRef, value));
    }
  }

  const usingRealFields = customFieldsArray.length > 0;
  console.log(`[agency-onboarding] Custom fields to write: ${customFieldsArray.length} (of ${Object.keys(body.customFields || {}).length} submitted)`);

  // ── STEP 1: Update standard fields + tag (always, no custom fields here) ─────
  try {
    await updateContact({
      pit:         agencyConfig.pit,
      contactId:   cid,
      firstName:   body.firstName,
      lastName:    body.lastName,
      email:       body.email,
      phone:       body.phone,
      companyName: body.companyName,
      address1:    body.address1,
      city:        body.city,
      state:       body.state,
      postalCode:  body.postalCode,
      tags:        ["onboarding-complete"],
    });
    console.log(`[agency-onboarding] ✓ Standard fields + tag written for cid=${cid}`);
  } catch (err) {
    console.error(`[agency-onboarding] Standard field update failed for cid=${cid}:`, err.message);
    return new Response(
      JSON.stringify({ error: "GHL contact update failed", detail: err.message }),
      { status: 502, headers: baseHeaders }
    );
  }

  // ── STEP 2: Write custom fields (only if real refs exist) ─────────────────────
  if (usingRealFields) {
    try {
      await updateContact({
        pit:          agencyConfig.pit,
        contactId:    cid,
        customFields: customFieldsArray,
      });
      console.log(`[agency-onboarding] ✓ ${customFieldsArray.length} custom fields written`);
    } catch (err) {
      console.error(`[agency-onboarding] Custom field write failed (non-fatal):`, err.message);
    }
  }

  // ── STEP 3: If no real custom field refs, save full data as a contact note ────
  if (!usingRealFields) {
    try {
      await createContactNote({
        pit:       agencyConfig.pit,
        contactId: cid,
        body:      `${summary}\n\n(Saved as note — custom field mapping not yet configured)`,
      });
      console.log(`[agency-onboarding] ✓ Full submission saved as contact note`);
    } catch (noteErr) {
      console.error(`[agency-onboarding] Note creation failed (non-fatal):`, noteErr.message);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      customFieldsWritten: customFieldsArray.length,
      savedAsNote: !usingRealFields,
    }),
    { status: 200, headers: baseHeaders }
  );
}
