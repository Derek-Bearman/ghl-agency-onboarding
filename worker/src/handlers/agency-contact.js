// src/handlers/agency-contact.js
// GET /agency/contact?cid=CONTACT_ID
//
// Called by the agency onboarding form on page load when a ?cid= param is present.
// Fetches the contact from the agency GHL sub-account and returns a pre-fill-ready
// object keyed by friendly field names (not raw GHL field IDs).
//
// Requires a "__agency" entry in the CLIENTS KV namespace (see agency KV template).

import { corsHeaders } from "../cors.js";
import { getContact } from "../ghl.js";

export async function handleAgencyContact(request, env) {
  const url = new URL(request.url);
  const cid = url.searchParams.get("cid");
  const baseHeaders = { ...corsHeaders(request), "Content-Type": "application/json" };

  if (!cid) {
    return new Response(
      JSON.stringify({ error: "Missing required parameter: cid" }),
      { status: 400, headers: baseHeaders }
    );
  }

  // Load agency config from KV
  const agencyConfig = await env.CLIENTS.get("__agency", { type: "json" });
  if (!agencyConfig) {
    console.error("[agency-contact] __agency KV entry not found");
    return new Response(
      JSON.stringify({ error: "Agency not configured" }),
      { status: 500, headers: baseHeaders }
    );
  }

  // Optional origin check (add allowedOrigins to KV entry to restrict access)
  if (agencyConfig.allowedOrigins && agencyConfig.allowedOrigins.length > 0) {
    const origin = request.headers.get("Origin") || "";
    if (origin && !agencyConfig.allowedOrigins.includes(origin)) {
      console.log(`[agency-contact] Origin rejected: ${origin}`);
      return new Response(
        JSON.stringify({ error: "Origin not allowed" }),
        { status: 403, headers: baseHeaders }
      );
    }
  }

  // Fetch contact from GHL
  let ghlContact;
  try {
    ghlContact = await getContact({ pit: agencyConfig.pit, contactId: cid });
  } catch (err) {
    console.error("[agency-contact] GHL fetch failed:", err.message);
    return new Response(
      JSON.stringify({ error: "Contact fetch failed" }),
      { status: 502, headers: baseHeaders }
    );
  }

  if (!ghlContact) {
    return new Response(
      JSON.stringify({ error: "Contact not found" }),
      { status: 404, headers: baseHeaders }
    );
  }

  // Reverse-map GHL custom field IDs → friendly names using the agency KV mapping.
  // GHL returns customFields as an array: [{ id: "GHL_FIELD_ID", value: "..." }, ...]
  const customFieldMapping = agencyConfig.customFieldMapping || {};
  const reverseMap = Object.fromEntries(
    Object.entries(customFieldMapping).map(([name, id]) => [id, name])
  );

  // Pre-populate all known field names with empty strings so the form always
  // gets the full expected shape, even for fields not yet populated in GHL.
  const customFieldsResult = {};
  for (const name of Object.keys(customFieldMapping)) {
    customFieldsResult[name] = "";
  }
  // Overwrite with actual GHL values
  for (const cf of ghlContact.customFields || []) {
    const name = reverseMap[cf.id];
    if (name !== undefined) {
      customFieldsResult[name] = cf.value ?? "";
    }
  }

  const contact = {
    firstName:   ghlContact.firstName   || "",
    lastName:    ghlContact.lastName    || "",
    email:       ghlContact.email       || "",
    phone:       ghlContact.phone       || "",
    companyName: ghlContact.companyName || "",
    address1:    ghlContact.address1    || "",
    city:        ghlContact.city        || "",
    state:       ghlContact.state       || "",
    postalCode:  ghlContact.postalCode  || "",
    customFields: customFieldsResult,
  };

  return new Response(
    JSON.stringify({ ok: true, contact }),
    { status: 200, headers: baseHeaders }
  );
}
