# GHL Workflow #1 — Send Onboarding Email

**Purpose:** Automatically email a new client their personalized onboarding form link the moment the agency owner tags them. Eliminates the manual "copy-the-contact-ID-and-paste-it-into-the-URL" step.

**Trigger tag:** `send-onboarding`
**Sub-account where this lives:** Acme Agency agency (`YOUR_GHL_LOCATION_ID`) — the same sub-account that owns the onboarding form and the contact record being onboarded.

---

## Build steps in GHL

### 1. Create the workflow

GHL → Automation → Workflows → **+ Create Workflow** → Start from Scratch.

- **Name:** `Send Onboarding Email`
- **Description:** `Tag-triggered. Emails the contact their personalized onboarding link.`
- **Save**, then proceed to the canvas.

### 2. Trigger — Contact Tag

Click **Add New Trigger** → Workflow Trigger → **Contact Tag**.

- **Workflow Trigger Name:** `Tag added: send-onboarding`
- **In Tag:** `send-onboarding`
- **Filters:** none.
- **Save Trigger.**

### 3. Action — Send Email

Click **+** under the trigger → **Send Email**.

- **Action Name:** `Send personalized onboarding link`
- **From Name:** `the agency owner — Acme Agency`
- **From Email:** the verified sender on the agency sub-account (use whatever sender is wired to `youragency.com` — typically `you@youragency.com`)
- **Reply-to Email:** same as From
- **Subject:** `Welcome to Acme, {{contact.first_name}} — let's get you onboarded`

**Email body** (paste into the rich-text editor and let it render the merge tags):

```
Hi {{contact.first_name}},

Thanks for partnering with Acme Agency — I'm excited to get you up and running.

To kick things off, I need about 5 minutes of your time to fill out our onboarding form. This is where you'll share the business details I need to build out your marketing infrastructure (services, hours, brand colors, GMB info, etc.).

It's pre-filled with what I already have on file for you, so most of the work is just confirming a few things and answering a handful of questions.

👉 Open your onboarding form:
https://onboarding.youragency.com/YOUR-FUNNEL-PAGE-SLUG?cid={{contact.id}}

If anything looks off or you get stuck on a question, just reply to this email — I'll take care of it.

Talk soon,
the agency owner
Acme Agency
```

**Important:** the link **must** use `{{contact.id}}` (with the underscore — that's GHL's merge tag format). When the email renders, `{{contact.id}}` is replaced with the actual contact ID and the form pre-fills correctly.

- **Save Action.**

### 4. Action — Remove Tag (so it doesn't keep re-firing)

Click **+** under the Send Email action → **Remove Contact Tag**.

- **Action Name:** `Remove send-onboarding tag`
- **Tag(s):** `send-onboarding`
- **Save Action.**

### 5. Action — Add Tracking Tag (optional but recommended)

Click **+** → **Add Contact Tag**.

- **Action Name:** `Mark as onboarding-sent`
- **Tag(s):** `onboarding-sent`
- **Save Action.**

> Why: lets you filter the smart list for "contacts who got the form but haven't submitted yet" so you can follow up with stragglers.

### 6. Workflow settings

Top right → **Settings**.

- **Allow Re-Entry:** ON — so if the agency owner removes `send-onboarding` and re-adds it (e.g., to resend), the workflow fires again.
- **Stop on response:** OFF.
- **Status:** Publish (toggle from Draft → Publish at the top right).

---

## Test plan

1. Pick a test contact in the agency sub-account (use [example client] if his form isn't submitted yet, or create a `test@youragency.com` contact).
2. Add the `send-onboarding` tag manually.
3. Within ~30 seconds, the email should arrive at the contact's address.
4. Verify the link in the email is `https://onboarding.youragency.com/YOUR-FUNNEL-PAGE-SLUG?cid=ACTUAL_CID_HERE` (not literally `{{contact.id}}`).
5. Click the link in the email — the form should load and pre-fill the contact's first/last name and company.
6. Confirm the `send-onboarding` tag was removed and `onboarding-sent` was added on the contact record.

---

## Common issues

- **Merge tag shows literally in the email** (`{{contact.id}}` not replaced): you typed it wrong, or the rich-text editor escaped it. Use the merge-tag picker in GHL's email editor rather than typing the braces by hand.
- **Email doesn't fire:** workflow is still in Draft. Toggle to Publish.
- **Email goes to spam:** the sending domain isn't fully authenticated. Confirm SPF + DKIM are green on the Acme sending domain in GHL's email settings.
- **Form loads but says "Could not load your saved information":** the contact ID in the URL is wrong, or the CF worker can't reach GHL. Check the worker logs in the Cloudflare dashboard.

---

## How to use this from now on

Old way: create contact → copy ID from URL bar → paste into `?cid=` → paste into a manual email.

New way: create contact → add tag `send-onboarding`. Done.
