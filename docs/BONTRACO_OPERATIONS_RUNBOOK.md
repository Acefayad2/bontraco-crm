# Bontraco Operations Runbook

## Service map

- Netlify serves the React application and seventeen server functions.
- Supabase provides authentication, Postgres, row-level security, and private file storage.
- Tavily and Google Places are optional lead sources. A missing key must fail only that provider run.
- Stripe is authoritative for subscription status; Supabase stores the projected state.
- Retell is the first supported voice provider; signed webhooks create private call records.

## Routine checks

Daily:

1. Review failed `lead_scan_runs`, failed `billing_webhook_events`, urgent-call alerts, and provider dashboards.
2. Confirm the latest scheduled lead scan and Retell reconciliation completed.
3. Check Netlify function errors and Supabase security advisories.

For a controlled acceptance run, an owner or admin may select **Run now** on one Lead Engine search profile. The server validates the signed-in user, exact workspace, profile ownership, paid lead-engine entitlement, daily result cap, daily provider-request cap, and a one-minute cooldown before calling the provider. Failed provider attempts count against the request cap, preventing a broken key or empty query from spending indefinitely. This action can test a paused profile without enabling its recurring schedule. Do not retry a failed provider run repeatedly; use its recorded error and provider dashboard first.

Before a release preview, run `npm run verify:release`, then run `npm run smoke:browser -- <immutable-preview-app-url>`. For a production-style draft that must redirect unauthenticated `/app` traffic, use `npm run smoke:browser:auth -- <immutable-preview-app-url>`. Never replace either command with a mutable production URL while gathering release evidence.

Manual and scheduled workers share a service-role-only, two-minute database lease for each profile. An overlapping request is skipped as `scan_in_progress` without calling the provider or recording a false failure. The exact worker token is required to release the lease, and an abandoned lease expires automatically. Repeated `scan_in_progress` results beyond two minutes indicate a clock, database, or worker-lifecycle problem and should be investigated before changing the lease duration.

The scheduled collector reads at most twenty due profiles, resolves their entitlements concurrently, and runs no more than four paid profiles in one parallel batch. This bound protects the provider budget and Netlify's 30-second scheduled-function limit. A persistent due-profile backlog is an operational warning; investigate provider latency or split the queue rather than raising the batch cap without a timed load test.

Each profile has a database-enforced ceiling of 96 provider requests per UTC day. Public-web profiles default to 96 requests at a 15-minute cadence; Google Places profiles default to 20 requests and a daily cadence because directory records change less frequently. Growth workspaces may keep three search profiles and AI Pro workspaces five. Do not raise these limits until actual provider cost, conversion yield, and tenant gross margin have been reviewed.

Weekly:

1. Export Netlify and provider usage; compare unexpected volume to configured limits.
2. Review accounts in `past_due`, `unpaid`, or `incomplete_expired` status.
3. Sample one owner, sales, and field account to confirm role visibility.
4. Review exposed credentials and rotate any key that left its approved secret store.

## External operations alerts

The scheduled `operations-monitor` runs every five minutes. It deduplicates failed lead scans, failed billing webhooks, failed account purges, and urgent calls into the server-only `operational_incidents` queue. Purge failures are critical and carry no account or error detail in their incident payload. Ordinary signed-in users cannot read or write that queue.

Set `OPERATIONS_ALERT_WEBHOOK_URL` only to an approved HTTPS on-call endpoint. Delivery contains the environment, incident total, counts by incident type and severity, and the oldest detection time. It never includes workspace IDs, names, phone numbers, email addresses, transcripts, summaries, recordings, or source-record IDs.

Failed deliveries retain a sanitized error and retry up to ten times. Investigate any undelivered incident at the retry limit, repair the endpoint, and reset only the reviewed incident's attempt count. Do not paste customer content into the on-call channel while investigating.

## Retell ingress failures

Retell lifecycle and tool endpoints verify signatures before parsing. A correctly signed but malformed or non-object payload returns `400` with `Request body must be a JSON object` and performs no database work. Repeated 400 responses indicate a provider tool/webhook payload configuration problem; inspect Retell delivery metadata without copying transcripts, caller details, or credentials into broad logs.

The lifecycle webhook returns success only after required call, metering, and event rows are stored. `Could not record call usage` or `Could not record call event` is a retryable server-side persistence failure. Retell may deliver the event again; the provider call ID, external usage ID, and provider event ID conflict keys keep these retries idempotent. Investigate Supabase availability and constraints before manually replaying an event.

`Could not load receptionist settings` indicates a database/query outage and is intentionally distinct from an enabled-workspace or transfer-number configuration response. Treat repeated occurrences as an availability incident and verify Supabase before changing receptionist configuration.

`Call timestamps are invalid` indicates a signed provider payload whose supplied start/end timing is not finite numeric milliseconds or whose end precedes its start. This response performs no database work. Inspect the Retell webhook/tool schema and delivery metadata; do not coerce timestamp strings manually or replay the delivery until the provider payload is corrected.

Owner/admin test calls fail before provider spend if authentication, membership, suppression, settings, or the daily-cap query cannot be verified. Do not bypass these checks during an outage. If the UI reports `Test call started, but call history is delayed. Do not retry.`, the provider already accepted the call but its CRM tracking write failed; investigate Supabase and reconcile the call instead of placing another test call.

Hourly call reconciliation fails before Retell retrieval if either the completed-call query or existing-usage query fails. Do not treat `Call reconciliation failed` as evidence that usage is missing, and do not trigger a manual provider sweep during that database outage; the next healthy scheduled run will retry the same seven-day window.

## Account deletion runbook

The scheduled `account-purge` function is a fail-closed finalizer. It runs once daily, accepts no public web requests, processes at most one workspace, and does nothing unless `ACCOUNT_PURGE_ENABLED` is exactly `true`. Keep that variable `false` until the backup/restore drill and a non-production purge rehearsal have passed.

An owner request remains recoverable for 14 days. A user cannot approve or accelerate it. After the grace period, an operator must complete every step below before setting the request to `approved`:

1. Re-verify the requester is the current workspace owner and that the request remains `pending`.
2. Generate the owner export. Settings hashes the exact response bytes in the browser and refuses to save a missing, malformed, or mismatched checksum; separately capture the `x-bontraco-sha256` response header and independently SHA-256 hash the downloaded file. Require the two digests to match each other and the tenant `account_exported` audit event, record the secure delivery location, and confirm the customer accepted delivery or declined it in writing.
3. Confirm the request is past `scheduled_for`, no legal/financial hold applies, and required commercial records may be deleted.
4. Record an operations ticket, named approver, approval timestamp, `export_verified: true`, the JSON artifact's SHA-256 as `export_sha256`, and `provider_cleanup_authorized: true` in request metadata. If registered private files exist, separately retrieve and reconcile those objects, then record `file_export_verified: true`, the exact current row count as `file_export_count`, and the file manifest's SHA-256 as `file_export_manifest_sha256`.
5. Change only that request from `pending` to `approved` with a reviewed service-role operation. Never expose an approval endpoint to workspace users.
6. Observe the next scheduled run. Success must cancel/delete Stripe customer data when present, delete Retell call artifacts when present, remove registered private files, cascade the workspace database rows, and mark the preserved request `completed`.
7. If the request becomes `failed`, leave the purge disabled while investigating. The worker deliberately refuses workspaces above its bounded call/file limits; those require a separately reviewed manual deletion plan.

The owner export reads each tenant table in 1,000-row pages and refuses the download if any table reaches 50,000 rows. Never treat an export error as verified delivery or set `export_verified: true`; use a reviewed operator export process for an oversized workspace and reconcile its table counts before approval.

The endpoint also requires its tenant-scoped `account_exported` activity insert to succeed before it releases the attachment. If the UI reports `Workspace export failed`, confirm there is no new activity event and resolve the audit-write problem before retrying; never substitute an unaudited server artifact.

The serialized attachment must also stay at or below 5.5 MB, leaving safety margin beneath [Netlify's 6 MB buffered request/response limit](https://docs.netlify.com/build/functions/configuration/). Size validation runs before the audit insert. An oversized workspace therefore needs the same reviewed operator export process as a row-limit refusal; do not weaken the limit or mark the deletion export verified.

The JSON includes pending and accepted invitation email, role, inviter, expiry, acceptance, and creation history. Invitation credential digests are deliberately excluded. If invitation history is needed for a verification, use these allowlisted fields; never query, copy, or attach `token_digest` values to an export or support ticket.

The `users` section maps unique selected-workspace membership IDs to only email, account creation, last sign-in, and email-confirmation timestamps. It excludes Auth phone numbers, provider/application/user metadata, token/password state, and every non-member identity. A failed identity lookup fails the entire export; resolve the stale membership/Auth inconsistency instead of hand-editing or releasing a partial identity list.

The JSON export contains registered file metadata, not the private Storage objects themselves. When file rows exist, the purge worker requires separate `file_export_verified: true` evidence, the exact current file-row count, and a valid SHA-256 manifest checksum before it makes any destructive call. Build a restricted file inventory, retrieve every registered object, verify object count/checksums against that inventory, and retain the evidence in the deletion ticket. Never set the flag for metadata-only JSON.

The worker independently verifies that `metadata.approved_at` is at or after `scheduled_for`. Approval evidence created during the grace period is invalid and cannot become valid merely because the worker runs later; replace it with a reviewed post-grace approval before processing.

The `approved` to `processing` claim returns the current account, schedule, and metadata, which are validated again before any provider call or database deletion. Changing or revoking approval evidence before the claim therefore produces a durable failed request with operator-review guidance. Do not edit approval metadata after a request reaches `processing`; investigate or recover that claim through the documented failed-state path.

The worker is retry-safe for provider records that are already absent. It does not delete shared Retell agents or phone numbers, Supabase authentication users who may belong to other workspaces, preserved minimal deletion audit rows, managed backups inside their recovery window, or unregistered orphan storage objects. Audit those categories separately before claiming erasure is complete.

At the start of an enabled run, a deletion claim that has remained `processing` for more than one hour is marked `failed` with operator-review guidance. This recovery never resumes provider or database deletion. The incident monitor will surface the refreshed failure; determine which provider/database steps completed before manually returning it to any actionable state.

Deletion-request failures expose only a provider-configuration category, an automated call/file limit, or generic operator-review guidance. Do not expect raw provider or database text in `last_error`; use restricted Netlify/Supabase/provider diagnostics for investigation. If the worker reports `Could not record account purge failure`, treat the request state as unknown until it is re-read—never assume it changed to `failed`.

Both the `failed` and `completed` transitions require the database to return the exact request while its prior status is still `processing`. A zero-row response is a failed transition even when the database reports no query error. Treat `Could not record account purge completion` as an incident: the workspace deletion may already have finished, so inspect the preserved request and provider state before any manual action or retry.

## Original CRM import runbook

The database-backed prototype tables are preserved in the server-only `bontraco_legacy` schema. The `snapshot_crm_*` tables and archive manifest form the read-only migration baseline. Unsuffixed legacy tables remain active only through service-role compatibility views while the old production deploy is online. Do not grant `anon` or `authenticated` access, expose the schema itself through the API, modify the snapshot, or delete it before the owner accepts an import or provides written disposal approval. Remove the compatibility views only after Bontraco production promotion and a verified rollback window.

The active Bontraco owner can invoke the protected `legacy-lead-import` function after signing in. The service-only database bridge imports from the read-only snapshot, normalizes trade and status values, records minimal provenance, writes an audit activity, and uses an account-scoped deterministic deduplication key. A repeated run must report zero new inserts. Keep the snapshot through the rollback window even after a successful import.

1. Download and retain a read-only copy of the original `{ clients, jobs }` JSON before migration.
2. In Settings, choose the JSON file and review the dry-run counts, validation errors, and assignment warnings. The importer never trusts original user IDs; remap assignments after import.
3. Resolve every validation error before enabling the import action. A source client must have a unique ID, and each job must reference a client in the same file.
4. Import once. The normalized file digest makes an exact repeat idempotent, and every created contact, location, and job is written to a batch rollback manifest.
5. Compare source and target counts, sample customers/jobs, and verify automatically seeded trade checklists before declaring the batch accepted.
6. If the result is unacceptable, use the batch rollback action. Type its displayed confirmation phrase. Rollback removes only target IDs in that batch's manifest, records an audit event, and does not modify the original JSON.
7. Export the workspace after acceptance and keep both export checksums in the migration ticket. Never hand-edit import manifests or reuse them for unrelated cleanup.

## Incident priorities

- P0: cross-tenant data access, leaked service credential, unauthorized billing mutation, or unsafe receptionist instruction.
- P1: authentication outage, widespread data mutation failure, webhook backlog, or all lead/call ingestion unavailable.
- P2: one provider unavailable, scheduled scan delay, report error, or isolated customer workflow failure.

## First response

1. Record the incident start time, affected accounts, deployment ID, symptoms, and reporter.
2. Contain before repairing: disable the affected provider/profile, pause its webhook, or roll back the Netlify deploy.
3. For possible key exposure, rotate the credential at the provider and Netlify, then invalidate the old value.
4. For possible tenant exposure, preserve logs and disable the affected path; do not delete evidence.
5. Communicate only verified scope. Never include transcripts, phone numbers, secrets, or customer content in broad channels.

## Rollback

1. Select the last known-good Netlify production deploy and publish it through Netlify's rollback control.
2. Do not reverse an applied database migration destructively. Apply a forward repair migration.
3. If a new function writes incompatible rows, disable its schedule/webhook before application rollback.
4. Run the permission SQL suites and deployed smoke flow after rollback.
5. Record the recovery deploy and any data repair query in the incident log.

## Backup and restore drill

Before launch, and quarterly thereafter:

1. Confirm Supabase backups/PITR are enabled for the selected plan and record the available recovery window.
2. Restore into an isolated project or branch; never overwrite production for a drill.
3. Temporarily pause application/provider writes or compare to the recovery-point snapshot, then set `SOURCE_SUPABASE_URL`, `SOURCE_SUPABASE_SERVICE_ROLE_KEY`, `RESTORE_SUPABASE_URL`, and `RESTORE_SUPABASE_SERVICE_ROLE_KEY` in the operator's secret environment. Never place these values in shell history, a ticket, or a repository file.
4. Run `npm run verify:restore`. It refuses to compare a project to itself, reads no row contents, and compares exact counts for authentication users plus every critical public table, including billing queues, incidents, communication preferences, and account-deletion records.
5. Investigate every reported difference against the documented recovery point. A zero-difference result verifies row-count parity only; it does not prove usable files, valid permissions, or correct workflows.
6. Compare private Storage object inventory to the `files` registry and open a sample through signed URLs. Record missing or orphaned objects without copying customer filenames into a broad ticket.
7. Run all SQL isolation suites against the isolated restore.
8. Open the restored app with non-production provider keys and complete lead-to-invoice smoke testing.
9. Record recovery point objective, recovery time, missing artifacts, operator, and date.

## Signed-in role acceptance

Run this only against an isolated preview and the intended non-production Supabase project.

1. Confirm `SUPABASE_URL` matches the project and the preview-scoped `SUPABASE_SERVICE_ROLE_KEY` contains the complete Supabase backend secret. A placeholder, masked display value, or truncated key is invalid.
2. Set `BONTRACO_PREVIEW_URL` to the exact HTTPS deploy preview being tested.
3. Run `npm run smoke:roles:full -- <run-id>` inside the Netlify deploy-preview environment. It creates deterministic owner, admin, dispatcher, sales, and field fixtures plus an independent outsider tenant; signs in as each role; verifies exact customer, job, appointment, lead, suppression, and consent visibility; probes known foreign workspace, customer, property, job, appointment, lead, suppression, and consent IDs; checks owner/admin-only integration status; and always cleans up both workspaces and every fixture user in a `finally` path.
4. Test the deployed site with demo mode disabled. Verify navigation, assigned-record visibility, manager controls, and direct guessed foreign IDs for every role.
5. Confirm both temporary workspace slugs and all six temporary authentication users are absent before recording the acceptance result. The automated runner deliberately stops before creating anything when the backend secret is missing or truncated.
6. Record the preview deploy, run ID, exact role results, cleanup result, operator, and date.

## Browser acceptance

Run `npm run smoke:browser -- <exact-preview-url>/app` after every preview deployment. The pinned CLI check visits Overview and all ten workspace sections; traverses every CRM section independently at 360, 390, 430, 768, 1280, and 1440 pixels; repeats the all-section reflow check at 640×450; and runs the six-width structure, control-naming, overflow, and exact document-title matrix across marketing, login, signup, password-reset request, password update, missing-token invitation, and unavailable-estimate routes. Workspace title checks must identify both the active section and company. The gate requires one visible main landmark and H1 per view, continuous heading levels, unique DOM IDs, names on visible navigation landmarks, and naming evidence for every visible button, link, input, select, and textarea; confirms sample mutations remain disabled; exercises company estimate defaults, logo control, printable proposal, and printable invoice; verifies that invalid customer links fail safely without echoing their token; fails on browser console errors; verifies visible keyboard focus; proves first-stop skip navigation, a unique visible current-page marker, and a polite atomic SPA section announcement; proves modal focus entry plus forward/reverse Tab containment and opener restoration; and confirms reduced-motion styles suppress transitions. Run `npm run smoke:browser:auth` against the ordinary production-mode build to confirm `/app` redirects to login and never exposes the sample workspace. Run `VITE_DEMO_MODE=true npm run build` before the local demo smoke. The CI workflow installs its Chromium runtime and performs both modes automatically.

Run `npm test -- auth-error.test.ts` after changing authentication or invitation handling. User-facing failures must remain actionable without echoing raw Supabase, network, or database error text; provider details belong only in approved server-side diagnostics.

Run `npm test -- onboarding-error.test.ts` after changing workspace creation. Preserve duplicate-name, existing-membership, invalid-name, expired-session, and network guidance, but never render unknown RPC, Postgres, policy, schema, constraint, or database text.

Run `npm test -- team-error.test.ts` after changing team invitations, roles, access status, or invitation cancellation. Preserve specific duplicate, plan-limit, and subscription guidance, but never render unknown Supabase or Postgres messages to workspace administrators.

Run `npm test -- lead-error.test.ts` after changing lead creation, status, assignment, or conversion. Preserve only approved validation and stale-record guidance; missing and access-denied records must remain indistinguishable, and unknown Supabase or Postgres messages must never reach the lead inbox.

Run `npm test -- lead-engine-error.test.ts lead-scan.test.js` after changing lead-source profiles, manual scans, provider collection, or scan history. Persist and display only approved plan, limit, validation, readiness, session, cooldown, and daily-cap guidance; raw provider bodies, server errors, RLS details, and database responses must remain private.

Run `npm test -- customer-error.test.ts` after changing customer creation, assignment, or service-location management. Preserve approved input guidance, keep missing and unauthorized locations indistinguishable, and never render unknown Supabase or Postgres messages to CRM users.

Run `npm test -- job-error.test.ts` after changing job creation, assignment, stages, notes, checklists, or private files. File size/type validation can remain specific, but provider, Storage, policy, schema, constraint, and signed-URL failures must use approved action-specific guidance.

Run `npm test -- work-planning-error.test.ts` after changing appointment or task mutations. Schedule and task failures must identify the attempted action and recovery step without including raw Supabase or Postgres text.

Run `npm test -- call-error.test.ts` after changing receptionist settings, call assignment, or test calls. Only explicitly approved test-call server messages may reach users; unknown responses, thrown requests, and provider/database failures must use stable local guidance and always release the busy state.

Run `npm test -- commercial-error.test.ts` after changing estimate creation/status, invoice conversion, customer-link creation, or payment recording. Preserve only approved estimate validation and stale-record guidance; customer-link failures must not reveal whether a protected estimate exists, and unknown provider, server, or database text must never reach users.

Run `npm test -- estimate-acceptance-error.test.ts estimate-share-functions.test.js EstimateAcceptancePage.test.tsx` after changing public estimate loading or acceptance. Missing, inaccessible, revoked, expired, closed, and failed links must remain indistinguishable; only approved signer-name, optional-email, acknowledgment, and connection guidance may reach anonymous customers.

Run `npm test -- settings-error.test.ts` after changing company profiles, document defaults, or proposal-logo operations. Preserve approved field validation, but never render unknown Supabase, Postgres, policy, schema, constraint, or Storage text to workspace managers.

Run `npm test -- admin-operation-error.test.ts` after changing billing, workspace export, imports, import rollback, preserved-lead migration, or deletion controls. Preserve only approved plan, authorization, session, validation, import-state, exact-confirmation, and pending-request guidance; every thrown request must clear its busy state.

Login, signup, and reset-request routes are guest-only. Confirm an existing authenticated session returns to `/app` instead of exposing those forms. Do not apply the guest-only redirect to `/reset-password`: Supabase recovery links intentionally establish a temporary session before the user chooses a new password.

The browser gate downloads the 30-day Reports CSV, verifies its ISO-dated filename, reads the result, and checks representative metric rows. Export must remain disabled while the initial calculation is pending or whenever any source query fails; a successful refresh must clear the alert before export is restored. Run `npm test -- report-csv.test.ts` after changing report fields, ordering, file naming, serialization, or export readiness.

## Customer estimate links and acceptance

1. Create customer links only from an open draft, sent, or viewed estimate. Office managers can share workspace estimates; a sales user can share only an assigned job.
2. Copy the link when Bontraco displays it. The raw secret is never stored and cannot be recovered. Creating another link revokes the prior active unaccepted link.
3. Send links through an approved customer channel. Never paste them into broad tickets, logs, or team chat, and never collect them in analytics. URL fragments keep the token out of ordinary server and referrer requests.
4. If a link was exposed or sent to the wrong person, create a replacement immediately. Mark the estimate void, declined, or expired to make its link fail closed.
5. A repeat acceptance returns the original signer and time; it must not replace the evidence or create another audit event. Treat any mismatch between the frozen proposal and the CRM estimate as an incident and preserve both records.
6. Before launch, complete a real-role preview acceptance: create an estimate, issue and open its link on desktop and mobile, accept it, confirm the estimate becomes accepted, verify a second submit is idempotent, export the workspace, and then remove every fixture.

This is technical evidence capture, not a substitute for counsel-approved electronic-signature language, retention rules, or customer terms.

## Proposal branding and invoice documents

1. Owners/admins may upload only JPG, PNG, or WebP logos no larger than 2 MB. Verify transparent and wide logos remain readable in both estimate and invoice print previews before customer use.
2. Logos are intentionally public-read because customer documents open without authentication, but object listing and all writes remain restricted. Never upload confidential content, customer data, credentials, or internal-only marks as a company logo.
3. Replacing or removing the current logo affects future documents. Do not delete prior branding objects while an issued estimate snapshot, retention requirement, or dispute may reference them. Remove unreferenced objects only through a reviewed retention job.
4. Before sending an invoice, verify customer identity, service location, line items, tax, payments, balance, issue date, and due date. The printable document reflects the current invoice ledger and is not a payment-processing receipt.

Bontraco sets `assetsInlineLimit` to zero so bundled fonts remain same-origin files allowed by the strict production Content Security Policy. Treat any `data:font` build output or font-src browser violation as a release failure.

## Provider degradation

- Lead search: record a failed run and leave existing CRM data available. Do not loop without cadence, daily-result, and daily-request caps.
- Google Places: pause the profile if quota or billing errors repeat; retain Place ID and refresh provider content under the applicable terms.
- Stripe: keep customer data intact, retry signed events idempotently, and reconcile subscription state before changing access manually.
- Retell: transfer to the configured human number or voicemail. Emergency language must never be replaced with autonomous diagnosis.
- Outbound communication: fail closed when the suppression ledger cannot be checked. Never treat a public phone number or email address as consent, and never bypass an active workspace suppression.

## Release evidence

`npm run build` must end with `Bontraco deployment artifact audit passed` before any preview or production upload. The audit inspects every file in the final browser `dist` tree and every Netlify function/shared-source file for source maps, embedded source-map references, and recognizable provider/backend secret formats. Treat any failure as a release blocker; rotate a detected credential if it was ever present in a deployment file, and never paste the artifact contents into a ticket.

The same audit enforces mobile-loading budgets of 350 KiB for any individual browser script and 1,100 KiB for aggregate browser JavaScript. Do not raise either threshold to pass a release; split or remove the regressing code, rebuild, and attach the passing asset-size output to release evidence.

Netlify's production context must show `npm run preflight:production && npm run build` in the deploy log. Stop the release if compilation starts before the preflight succeeds. Deploy previews intentionally use the normal sample-mode build and do not satisfy this production gate.

Every production release must retain:

- commit or source revision;
- Netlify deploy ID and prior deploy ID;
- migration list;
- formatting, lint, unit, SQL, build, and browser results;
- environment/integration readiness status without secret values;
- rollback owner and decision time.
