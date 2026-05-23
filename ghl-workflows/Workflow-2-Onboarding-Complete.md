# GHL Workflow #2 — Notify the agency owner on Onboarding Complete

**Purpose:** When a client submits the onboarding form, the CF Worker automatically tags the contact with `onboarding-complete`. This workflow listens for that tag and emails the agency owner a full summary of the submission so he can immediately start Phase 0 work without logging into GHL to dig through fields.

**Trigger tag:** `onboarding-complete` (added by the worker — do not add manually)
**Sub-account where this lives:** Acme Agency agency (`YOUR_GHL_LOCATION_ID`)

---

## Build steps in GHL

### 1. Create the workflow

GHL → Automation → Workflows → **+ Create Workflow** → Start from Scratch.

- **Name:** `Onboarding Complete — Notify the agency owner`
- **Description:** `Fires when worker tags contact with onboarding-complete. Emails the agency owner the full submission.`
- **Save** and proceed to the canvas.

### 2. Trigger — Contact Tag

Click **Add New Trigger** → Workflow Trigger → **Contact Tag**.

- **Workflow Trigger Name:** `Tag added: onboarding-complete`
- **In Tag:** `onboarding-complete`
- **Filters:** none.
- **Save Trigger.**

### 3. Action — Send Internal Email to the agency owner

Click **+** under the trigger → **Send Internal Notification** (preferred) **or** **Send Email** with the agency owner's address hard-coded.

> **Why Internal Notification:** it doesn't count against email sends, it's routed clearly as a system alert, and it appears in GHL's internal notification log. If the Internal Notification action isn't available in your plan, just use a regular Send Email with `you@youragency.com` as the recipient.

**Send Internal Notification configuration:**

- **Action Name:** `Email the agency owner — new onboarding submission`
- **Type:** Email
- **To User:** the agency owner (select your user account from the dropdown)
- **From Name:** `Agency Onboarding Bot`
- **From Email:** the verified sender on the sub-account
- **Subject:** `✅ Onboarding submitted — {{contact.company_name}} ({{contact.first_name}} {{contact.last_name}})`

**Email body** (paste into the editor — merge tags will resolve when it fires):

```
A client just completed their onboarding form. Full submission below.

═══════════════════════════════════════
CLIENT
═══════════════════════════════════════
Company:     {{contact.company_name}}
Contact:     {{contact.first_name}} {{contact.last_name}}
Email:       {{contact.email}}
Phone:       {{contact.phone}}
Address:     {{contact.address1}}, {{contact.city}}, {{contact.state}} {{contact.postal_code}}
GHL ID:      {{contact.id}}

═══════════════════════════════════════
BUSINESS BASICS
═══════════════════════════════════════
Legal Name:    {{contact.legal_business_name}}
EIN:           {{contact.ein}}
Service Area:  {{contact.service_area}}
Services:      {{contact.services_offered}}
Lead Magnet:   {{contact.lead_magnet_offer}}
Differentiator: {{contact.key_differentiator}}

═══════════════════════════════════════
HOURS
═══════════════════════════════════════
Days:           {{contact.business_hours_days}}
Open:           {{contact.business_hours_open}}
Close:          {{contact.business_hours_close}}
Emergency/24h:  {{contact.emergency_after_hours}}

═══════════════════════════════════════
BRAND
═══════════════════════════════════════
Logo URL:       {{contact.logo_url}}
Primary Color:  {{contact.brand_color_primary}}
Accent Color:   {{contact.brand_color_accent}}
Tone:           {{contact.brand_tone}}

═══════════════════════════════════════
DOMAINS
═══════════════════════════════════════
Primary:        {{contact.domain_primary}}
Alternate:      {{contact.domain_alternate}}

═══════════════════════════════════════
ONLINE PRESENCE
═══════════════════════════════════════
Facebook:       {{contact.facebook_page_url}}
GMB Status:     {{contact.gmb_status}}
Reviews URL:    {{contact.review_gmb_url}}
Notes:          {{contact.notes_online_presence}}

═══════════════════════════════════════
CUSTOMER LIST
═══════════════════════════════════════
Has List:       {{contact.has_customer_list}}
Notes:          {{contact.notes_customer_list}}

═══════════════════════════════════════
REQUESTS & QUESTIONS
═══════════════════════════════════════
Site Requests:  {{contact.notes_site_requests}}
Questions:      {{contact.client_questions}}

═══════════════════════════════════════
NEXT STEPS
═══════════════════════════════════════
1. Open contact in GHL: https://app.gohighlevel.com/v2/location/YOUR_GHL_LOCATION_ID/contacts/detail/{{contact.id}}
2. Begin Phase 0 work on the dedicated sub-account
3. Reply to the client confirming receipt and next milestone

— Agency Onboarding Bot
```

> **Merge-tag note:** the exact merge-tag names depend on the GHL field key (e.g., `{{contact.legal_business_name}}` corresponds to the field with key `contact.legal_business_name`). Use the merge-tag picker in GHL's email editor to insert these — don't type them by hand — so any field-key drift is caught immediately.

- **Save Action.**

### 4. Action — Add Tracking Tag

Click **+** → **Add Contact Tag**.

- **Action Name:** `Mark as onboarding-notified`
- **Tag(s):** `onboarding-notified`
- **Save Action.**

> Why: a single source of truth for "I already saw this submission." Prevents double-handling and lets you build a smart list of "submitted but not yet started Phase 0."

### 5. (Optional) Action — Internal Task

Click **+** → **Create Task**.

- **Action Name:** `Create Phase 0 task`
- **Assigned To:** the agency owner
- **Title:** `Begin Phase 0 — {{contact.company_name}}`
- **Due Date:** +2 business days from now
- **Description:** `Onboarding submitted. Sub-account, snapshot, lead capture, nurture, site, GMB.`

### 6. Workflow settings

- **Allow Re-Entry:** OFF — submission notification should only fire once per contact.
- **Status:** Publish.

---

## Test plan

1. Pick a test contact in the agency sub-account.
2. Manually add the `onboarding-complete` tag.
3. Within ~30 seconds, an email should land in the agency owner's inbox with all the fields filled in.
4. If a field is empty in GHL, the merge tag will render as a blank line — that's fine (the worker will only have written what the client provided).
5. Confirm `onboarding-notified` was added to the contact after the email sent.
6. Cleanup: remove both `onboarding-complete` and `onboarding-notified` from the test contact so the next real submission triggers cleanly.

---

## Common issues

- **Email body shows literal `{{contact.field_name}}` text:** the merge tag doesn't match an actual field key. Re-pick it from the merge-tag picker.
- **Workflow doesn't fire:** verify the tag spelling exactly matches `onboarding-complete` (no underscore, no capital letters) — that's what the worker writes.
- **Email arrives empty for most custom fields:** the worker wrote to the contact note (fallback) rather than to custom fields. Check Cloudflare logs for `Saved as note — custom field mapping not yet configured` — if you see that, the `__agency.json` mapping is using placeholders and needs the real field keys.
