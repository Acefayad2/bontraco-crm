# Bontraco Architecture

## Architecture decision

Bontraco will remain a responsive web application hosted on Netlify while the existing product is migrated in controlled slices. The production source of truth will be Supabase Postgres, Auth, and Storage. Netlify Functions will hold trusted provider integrations, webhook handlers, scheduled collectors, and operations that require secret keys.

The current single HTML file is treated as a prototype UI and migration source, not the long-term application boundary.

## Target system

```text
Browser
  -> Bontraco web app
      -> Supabase Auth
      -> Supabase Data API guarded by RLS
      -> private Supabase Storage via signed URLs
      -> Netlify Functions for trusted operations

Netlify Functions
  -> Supabase service client for narrow server jobs
  -> Stripe Checkout, Portal, and signed webhooks
  -> voice provider and telephony webhooks
  -> AI model gateway
  -> permitted search and Places providers

Scheduled jobs
  -> collect candidates
  -> normalize and score
  -> deduplicate per workspace
  -> write scan run and leads
  -> emit observable result
```

## Security boundaries

- The browser receives only the Supabase URL and publishable key.
- Supabase secret/service credentials, Stripe secret, voice credentials, search keys, Maps key, and model keys remain in server environment variables.
- Every customer-owned row contains `account_id`.
- RLS derives access from the authenticated user and active membership, never from user-editable metadata.
- Server functions validate the bearer token, derive the actor and account on the server, and ignore client-supplied account ownership.
- Public webhooks validate provider signatures, use replay protection, and enqueue or perform idempotent processing.
- Platform support access is explicit, time-limited, and audited.

## Core data domains

### Identity and tenancy

- `accounts`
- `memberships`
- `invitations`
- `account_subscriptions`
- `notifications`
- `activities`
- `data_import_batches`
- `data_import_records`

### CRM

- `contacts`
- `properties`
- `leads`
- `jobs`
- `job_checklist_items`
- `appointments`
- `tasks`
- `notes`
- `activities`
- `files`

### Commercial workflow

- `pricebook_items`
- `estimates`
- `estimate_items`
- `invoices`
- `payments`

Customer estimate acceptance uses `private.estimate_share_tokens`, which is absent from the browser API. It stores only one-way token hashes, frozen proposal snapshots, expiry/revocation state, and acceptance evidence. Service-role-only RPCs create, read, accept, and export these records after the Netlify boundary validates the requesting workspace or customer token.

Proposal logos live in the public-read `bontraco-branding` Storage bucket because they appear on customer documents without an authenticated session. Upload metadata is not publicly listable; only active owners/admins can create or modify a path rooted in their exact account ID. The current path is stored on the account, while issued estimate snapshots retain their original path.

### Lead discovery

- `lead_source_profiles`
- `lead_scan_runs`

### AI receptionist

- `receptionist_settings`
- `calls`
- `call_events`
- `call_usage`

### Billing

- `subscription_plans`
- `account_subscriptions`
- `billing_webhook_events`

## Migration approach

1. Preserve the live deployment while adding a modular Bontraco application shell.
2. Add the new schema alongside the existing `crm_*` tables; do not destructively repurpose customer data.
3. Add a one-time importer from the prototype client/job payload and existing centralized leads.
4. Enable production authentication and remove both development bypasses before accepting real data.
5. Move one domain at a time to Supabase: tenancy, contacts/properties, jobs, leads, files, then billing and calls.
6. Keep temporary compatibility endpoints only while their callers exist; remove them after end-to-end parity tests.
7. Deploy previews first, run automated smoke tests, and promote only verified builds.

## Reliability rules

- All external calls use timeouts, bounded retries with jitter, and structured failure logs.
- Every webhook and scheduled job has an idempotency key.
- Scheduled lead scans record start, completion, provider counts, rejection reasons, cost, and failure state.
- Voice workflows degrade to voicemail or human transfer when dependencies fail.
- Billing outages never destroy customer data; entitlement changes are reconciled later.
- Destructive account deletion uses a recoverable grace period and documented purge job.

## Deployment environments

- Local: Supabase local stack where supported, provider mocks, no production secrets.
- Preview: isolated Netlify deploy using test Stripe and test voice credentials.
- Production: protected environment variables, production webhooks, monitoring, backups, and release tags.

## Required environment variables

Names are documented without values.

- `SUPABASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_PRO`
- `RETELL_API_KEY`
- `RETELL_AGENT_ID`
- `RETELL_FROM_NUMBER`
- `TAVILY_API_KEY` or an approved search provider key
- `GOOGLE_PLACES_API_KEY` (or temporary `GOOGLE_MAPS_API_KEY` compatibility name)
- `OPERATIONS_ALERT_WEBHOOK_URL` (HTTPS endpoint; receives aggregate incident counts only)

## Remaining launch risks

- Authenticated workspace access, dashboard totals/activity/alerts, lead, customer, job, schedule, call, report, lead-engine, and team views now refresh in the background every thirty seconds and on tab return. Membership deactivation therefore removes the workspace promptly while transient background query failures do not flash or destroy the last authorized UI; database RLS remains authoritative for every request. This provides near-live multi-device consistency without expanding database replication and is intentionally not a collaborative cursor/presence system.
- Duplicate-customer consolidation is a single owner/admin-only database transaction. It locks both tenant-checked contacts in identifier order, fills only blank survivor fields, reparents every direct CRM and receptionist relationship, preserves append-only consent and do-not-contact evidence, removes the duplicate only after successful reparenting, and writes one survivor-linked audit event. Any failed relationship update rolls the whole merge back.

- Demo mode is intentionally enabled only for deploy previews and must remain disabled in production.
- Netlify currently stores an invalid 20-character `SUPABASE_SERVICE_ROLE_KEY`; replace it with the existing Supabase `backend_api` secret in preview first, validate server functions, and update production only during the approved promotion procedure.
- Google Places, Stripe, and Retell production credentials and provider-side configuration are not connected.
- The old prototype tables and their 21 scraped leads are preserved in the non-exposed, server-only `bontraco_legacy` schema. A separate read-only snapshot and row-count manifest protect the migration baseline while temporary service-role-only compatibility views keep the currently published prototype functioning. Browser roles have no archive or compatibility-view access. The snapshot remains until a verified owner import or written disposal decision; obsolete root-level prototype code and migration copies are no longer part of the repository build.
- Full owner/admin/dispatcher/sales/field browser acceptance, backup restoration, a non-production final-purge rehearsal, and legal publication are unfinished. Export, recoverable deletion, and the fail-closed purge worker are implemented and covered by database tests.
- A five-minute server-only incident monitor, bounded retry queue, and privacy-safe aggregate webhook delivery are implemented. An approved on-call HTTPS endpoint remains to connect.
