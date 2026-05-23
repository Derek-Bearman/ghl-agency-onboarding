// ghl-additions.js
// ADD THESE TWO FUNCTIONS to your existing src/ghl.js
// (paste below the existing exports at the bottom of the file)

// ---------------------------------------------------------------------------
// getContact — fetch a single contact by ID from any GHL sub-account
// ---------------------------------------------------------------------------
export async function getContact({ pit, contactId }) {
  const resp = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    method: "GET",
    headers: headers(pit),
  });

  if (resp.status === 404) {
    return null; // Caller handles not-found gracefully
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GHL GET contact ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  // GHL wraps the contact object: { contact: { id, firstName, ... } }
  return data.contact || data;
}

// ---------------------------------------------------------------------------
// updateContact — update an existing contact by ID (PUT, not upsert-by-email)
// ---------------------------------------------------------------------------
export async function updateContact({
  pit,
  contactId,
  firstName,
  lastName,
  email,
  phone,
  companyName,
  address1,
  city,
  state,
  postalCode,
  tags,
  customFields,
}) {
  // Only send fields that are actually provided — don't overwrite with undefined
  const payload = {};
  if (firstName   !== undefined && firstName   !== "") payload.firstName   = firstName;
  if (lastName    !== undefined && lastName    !== "") payload.lastName    = lastName;
  if (email       !== undefined && email       !== "") payload.email       = email;
  if (phone       !== undefined && phone       !== "") payload.phone       = phone;
  if (companyName !== undefined && companyName !== "") payload.companyName = companyName;
  if (address1    !== undefined && address1    !== "") payload.address1    = address1;
  if (city        !== undefined && city        !== "") payload.city        = city;
  if (state       !== undefined && state       !== "") payload.state       = state;
  if (postalCode  !== undefined && postalCode  !== "") payload.postalCode  = postalCode;
  if (tags        && tags.length > 0)                 payload.tags        = tags;
  if (customFields && customFields.length > 0)        payload.customFields = customFields;

  const resp = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    method: "PUT",
    headers: headers(pit),
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GHL PUT contact ${resp.status}: ${text.slice(0, 200)}`);
  }

  return resp.json();
}

// ---------------------------------------------------------------------------
// upsertContact — idempotent create-or-update by email within a sub-account
//
// Used by the cold-URL intake endpoint. GHL's /contacts/upsert returns
//   { contact: { id, ... }, new: boolean, traceId }
// and matches existing contacts by email within the same locationId, so
// double-submissions don't create duplicates.
// ---------------------------------------------------------------------------
export async function upsertContact({
  pit,
  locationId,
  firstName,
  lastName,
  email,
  phone,
  companyName,
  tags,
}) {
  if (!locationId) {
    throw new Error("upsertContact: locationId is required");
  }
  if (!email) {
    throw new Error("upsertContact: email is required");
  }

  const payload = { locationId, email };
  if (firstName)   payload.firstName   = firstName;
  if (lastName)    payload.lastName    = lastName;
  if (phone)       payload.phone       = phone;
  if (companyName) payload.companyName = companyName;
  if (tags && tags.length > 0) payload.tags = tags;

  const resp = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: "POST",
    headers: headers(pit),
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GHL POST upsert ${resp.status}: ${text.slice(0, 200)}`);
  }

  return resp.json();
}
