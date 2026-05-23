# Cold-URL Support — Deploy & Verification

This adds a new `POST /agency/intake` endpoint to the worker and a name+email intake screen to the onboarding form. Walk-up visitors with no `?cid=` in the URL can now create their own contact record and then proceed through the normal onboarding flow.

---

## What changed

### Worker
- **NEW:** `src/handlers/agency-intake.js` — validates input, calls GHL upsert, returns CID
- **CHANGED:** `src/ghl-additions.js` — added `upsertContact()` helper (POST to `/contacts/upsert`, idempotent by email within the locationId)
- **CHANGED:** `src/index-updated.js` — registers the new `POST /agency/intake` route

### Form (`Acme-Onboarding-Form.html`)
- New cold-URL intake screen (name + email + optional company/phone)
- Init logic now branches: `?cid=` present → pre-fill from GHL; absent → show intake first
- After intake POST succeeds, hidden CID is set and the main 25-field form replaces the intake screen with the captured fields already populated
- A `cold-intake` tag is added to all walk-up contacts so they're distinguishable from the agency owner-initiated ones

---

## Deploy steps

> **Reminder:** Copy one command at a time. Never paste a block. The em dash in the repo folder path breaks zsh multi-line continuations.

### 1. Copy the new handler into the live worker repo

```
cp "<REPO_ROOT>/worker/src/handlers/agency-intake.js" ~/Downloads/leads-proxy/src/handlers/agency-intake.js
```

### 2. Append the new GHL helper to the live ghl.js

```
cp "<REPO_ROOT>/worker/src/ghl-additions.js" ~/Downloads/leads-proxy-ghl-additions-new.js
```

Then open `~/Downloads/leads-proxy-ghl-additions-new.js`, scroll to the bottom, copy only the new `upsertContact` function block (everything below the existing `updateContact` definition — the new section is clearly marked with its own header comment), and paste it at the end of `~/Downloads/leads-proxy/src/ghl.js`.

> Why not `cat >>`: we already appended `getContact` and `updateContact` to the live `ghl.js` in the last session. `ghl-additions.js` in this repo is the *cumulative* set (including those two). Re-appending the whole file would duplicate them. Paste only the new `upsertContact` block.

### 3. Replace the router

```
cp "<REPO_ROOT>/worker/src/index-updated.js" ~/Downloads/leads-proxy/src/index.js
```

### 4. Deploy

```
cd ~/Downloads/leads-proxy && npx wrangler deploy
```

Note the new version ID printed at the end — useful for rollback or telling teammates.

### 5. Upload the new form HTML to the GHL funnel

The form at `https://onboarding.youragency.com/YOUR-FUNNEL-PAGE-SLUG` is hosted in GHL Funnels.

1. Open the funnel/page editor in GHL.
2. Replace the embedded HTML/Custom Code block with the contents of `<REPO_ROOT>/form/Onboarding-Form.html`.
3. Save and publish.

---

## Verification checklist

### Worker — endpoint smoke test

Run this to confirm the new route is alive (substitute a test email):

```
curl -X POST https://your-worker.workers.dev/agency/intake -H "Content-Type: application/json" -H "Origin: https://onboarding.youragency.com" -d '{"firstName":"Test","lastName":"Walkup","email":"test-walkup-1@example.com","companyName":"Walkup Co","phone":"555-0100"}'
```

Expected: `{"ok":true,"cid":"...","isNew":true}` on first call, `isNew:false` on a re-run with the same email.

Verify in GHL: open the agency sub-account → Contacts → find `test-walkup-1@example.com`. Should be tagged `cold-intake`.

### Form — cold-URL flow

1. Open `https://onboarding.youragency.com/YOUR-FUNNEL-PAGE-SLUG` (no `?cid=`).
2. The intake card should appear, NOT the full form.
3. Fill in first name, last name, email; leave company and phone blank.
4. Click **Continue →**. Within ~2 seconds, the card should disappear and the main 25-field form should slide in with the name/email already populated.
5. Submit the full form.
6. In GHL, confirm the contact has both `cold-intake` AND `onboarding-complete` tags, and the custom fields are populated.

### Form — warm-URL flow (no regression)

1. Open `https://onboarding.youragency.com/YOUR-FUNNEL-PAGE-SLUG?cid=YOUR_CONTACT_ID` (Jane's CID — character 14 is uppercase I).
2. The intake card should NOT appear.
3. The main form should appear with greeting banner + Jane's pre-filled name/company.
4. Pre-existing behavior unchanged.

### Cleanup after testing

Delete the `test-walkup-1@example.com` contact (and any other test contacts) from GHL before going live with real clients.

---

## Rollback

If anything breaks, revert the worker to the last known good version:

```
cd ~/Downloads/leads-proxy && npx wrangler rollback
```

For the form: GHL's funnel editor keeps a version history — restore the previous version from there.

---

## Open follow-ups (after this lands)

- Build the two GHL workflows (`send-onboarding`, `onboarding-complete`) — see `ghl-workflows/` for guides.
- Decide whether cold-intake contacts should receive a different welcome flow vs. the agency owner-tagged ones (the `cold-intake` tag makes this easy if/when wanted).
- Consider adding a CAPTCHA or rate-limit to `/agency/intake` if walk-up volume grows — currently any origin in the allowlist can hit it.
