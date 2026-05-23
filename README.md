# Agency Onboarding for GoHighLevel

> One pre-filled form, a Cloudflare Worker as the trusted messenger, and GoHighLevel as the source of truth. End-to-end client onboarding for an agency that runs on GHL.

A reusable pattern for collecting 25+ structured business fields from a new agency client — without chasing them across a 12-email thread, without paying for a typeform/zap stack, and without exposing your GHL API keys to a public webpage.

Built originally for a one-person marketing agency. Forkable for any agency that uses GoHighLevel as their CRM.

---

## What problem this solves

Every new client engagement starts with the same painful information-gathering: legal business name, EIN, services, hours, brand colors, social URLs, GMB status, lead-magnet copy, on and on. The typical solutions:

- **Typeform + Zapier** — works, but pays $50+/month for plumbing
- **GHL native forms** — limited pre-fill, no smart routing, ugly
- **PDF/email back and forth** — chaos, retypes, no data ends up in your CRM cleanly

This system:

- One **branded form** that pre-fills everything you already have on file
- A **Cloudflare Worker** that holds the GHL keys safely (the form doesn't)
- Two **GHL workflows** that automate the "send the link" and "tell me when they submit" loops
- Cost: **$0** (Cloudflare Workers free tier handles thousands of submissions/month)
- Setup time: **~2 hours** end-to-end

[See the visual architecture](./docs/architecture.html) (open the file in a browser).

---

## How it works

```
┌──────────┐         ┌─────────────────┐         ┌──────────────┐
│  Form    │   ←→    │  Worker         │   ←→    │  GoHighLevel │
│  (HTML)  │         │  (Cloudflare)   │         │  (your CRM)  │
└──────────┘         └─────────────────┘         └──────────────┘
                            +
                       ┌──────────┐
                       │ KV store │
                       │ (config) │
                       └──────────┘
```

**Warm path** (you tagged the contact):
1. Tag a GHL contact `send-onboarding` → workflow emails them their link
2. They click → form loads → fetches their contact via Worker → pre-fills 25 fields
3. They submit → Worker writes everything back → tags `onboarding-complete`
4. Second workflow emails you a summary

**Cold path** (walk-up visitor with no link):
1. They hit the URL → see a small name + email card
2. Worker upserts a contact in GHL → returns ID
3. If their email matched an existing contact, full pre-fill kicks in (same as warm path)

---

## Repo tour

```
ghl-agency-onboarding/
├── worker/                          ← Cloudflare Worker
│   ├── src/
│   │   ├── index.js                  ← Router (adapt to your existing worker if you have one)
│   │   ├── ghl-additions.js          ← Append to your base ghl.js
│   │   └── handlers/
│   │       ├── agency-contact.js     ← GET /agency/contact?cid=
│   │       ├── agency-onboarding.js  ← POST /agency/onboarding
│   │       └── agency-intake.js      ← POST /agency/intake (cold-URL)
│   └── client-configs/
│       └── __agency.example.json     ← KV config template — fill in your own
│
├── form/
│   └── Onboarding-Form.html          ← Single-file HTML, paste into GHL funnel
│
├── ghl-workflows/                    ← Step-by-step GHL UI build guides
│   ├── Workflow-1-Send-Onboarding.md
│   └── Workflow-2-Onboarding-Complete.md
│
├── deploy/
│   ├── deploy-cold-url.sh            ← Adapt to your worker dir + run
│   └── COLD-URL-DEPLOY.md            ← Full deploy walkthrough
│
├── docs/
│   └── architecture.html             ← Visual one-pager you can share
│
├── .env.example                      ← Shape of values you'll need
├── EXISTING_FILES.md                 ← What's intentionally missing + why
└── LICENSE                           ← MIT
```

---

## Quick start

**Prerequisites:**
- A GoHighLevel account with a sub-account you control
- A Cloudflare account (free tier is fine)
- `node`, `npm`, `wrangler` installed locally (`npm install -g wrangler`)
- A custom domain pointing to your funnel (optional but nicer than the GHL default)

**1. Clone + scaffold the worker**

```bash
git clone https://github.com/Derek-Bearman/ghl-agency-onboarding.git
cd ghl-agency-onboarding/worker
npm init -y
npm install --save-dev wrangler
npx wrangler init  # creates wrangler.toml — adapt KV namespace
```

See `EXISTING_FILES.md` for the 5 minimal additions you need to make a complete worker.

**2. Get your GHL credentials**

In your GHL sub-account:
- Settings → Integrations → Private Integration → create a token with `Contacts.read` + `Contacts.write` + `Contacts.write` permissions
- Note your sub-account's `locationId` (visible in any URL: `/v2/location/<ID>/...`)
- Create 25 custom fields in a folder named "Onboarding" (the field names should match `__agency.example.json`'s `customFieldMapping`)

**3. Configure KV**

```bash
# Create your KV namespace
npx wrangler kv namespace create "CLIENTS"
# Note the ID it returns, paste into wrangler.toml

# Fill in worker/client-configs/__agency.example.json with your real values
# Then upload it to KV
npx wrangler kv key put "__agency" --path=worker/client-configs/__agency.json --namespace-id=YOUR_KV_NAMESPACE_ID --remote
```

**4. Deploy the worker**

```bash
cd worker
npx wrangler deploy
```

You'll get a `*.workers.dev` URL. That's your `WORKER_BASE`.

**5. Set up the form**

- Open `form/Onboarding-Form.html`
- Change `WORKER_BASE` to your worker URL
- Change `AGENCY_NAME` and brand colors at the top
- Create a funnel page in GHL → add a "Custom Code" block → paste the entire HTML

**6. Build the GHL workflows**

Follow the two guides in `ghl-workflows/`. Each takes 10–15 minutes to click through in the GHL UI.

**7. Test**

- Add a contact in GHL → tag with `send-onboarding`
- You should get an email with a link
- Click the link → fill the form → submit
- Check the contact in GHL — all 25 fields populated, `onboarding-complete` tag added
- You should get a summary email

---

## Customization

**Change the 25 fields** to fit your agency: edit `worker/client-configs/__agency.example.json`'s `customFieldMapping`, create matching GHL custom fields, and update the form's field IDs to match. The form's labels are easy to find via search.

**Change the form's look** by editing CSS variables at the top of the form HTML (`--brand-primary`, `--brand-accent`).

**Add a third workflow** (e.g., a 24-hour reminder if the form isn't submitted): the pattern is the same as Workflow #1 — tag + delay + email.

---

## Trade-offs and what this is NOT

- **Not a SaaS.** You host it yourself on Cloudflare. Good if you're technical and want zero vendor lock-in; not for you if you want a billable monthly tool.
- **GHL workflow setup is still manual.** GHL doesn't expose a public API for workflow creation, so you'll click through the guides once per workflow.
- **The included worker code assumes you're adding to an existing worker.** If you're starting fresh, see `EXISTING_FILES.md` for the 5 minimal scaffolding files you'll write.
- **No tests included.** This was built for a one-agency context; adding a test suite is left as an exercise. Smoke testing via `curl` is documented in `deploy/COLD-URL-DEPLOY.md`.

---

## Credit

Built by [Derek Bearman](https://github.com/Derek-Bearman) for [Arktos Marketing](https://arktosmarketing.com). Forks and improvements welcome.

The visual architecture diagram (`docs/architecture.html`) is built with Anthropic's `infographic-builder` skill — open and screenshot it for your own pitch decks if useful.

## License

MIT. Use freely. No warranty.
