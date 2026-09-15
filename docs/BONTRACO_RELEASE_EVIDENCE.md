# Bontraco Release Evidence

This log records verified development evidence. It is not production approval.

## 2026-09-15 trusted Stripe return origins preview

- Preview: `https://6aa894032f76fee295d2a642--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa894032f76fee295d2a642`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Return-origin safety: Checkout success/cancel and Customer Portal return URLs now come only from Netlify's exact HTTPS deploy or site URL. Missing, insecure, credentialed, malformed, path-bearing, query-bearing, or fragment-bearing values fail closed before Stripe initialization.
- Verification: two origin-validation cases bring the suite to 406 passing tests across 71 files. Formatting, lint, 325-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 82-file production artifact audit, zero-vulnerability runtime audit, 95-file preview artifact audit, Netlify function bundling, and exact deployed browser smoke passed.

## 2026-09-15 verified Stripe billing redirects preview

- Preview: `https://6aa8564fab10997463b3e694--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa8564fab10997463b3e694`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Redirect safety: Checkout and Customer Portal handoffs navigate only to credential-free HTTPS URLs on the exact `checkout.stripe.com` or `billing.stripe.com` hosts. Insecure, malformed, lookalike, or unexpected server responses remain inside Settings with safe recovery guidance.
- Verification: two URL-validation cases and one Settings component path bring the suite to 404 passing tests across 70 files. Formatting, lint, 323-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 81-file production artifact audit, zero-vulnerability runtime audit, 94-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded public estimate acceptance preview

- Preview: `https://6aa80225d0c4e3dd86b2ac92--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa80225d0c4e3dd86b2ac92`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Customer-link recovery: anonymous estimate loading, response parsing, acceptance submission, and accepted-snapshot parsing now use a thirty-second public workflow boundary. Unmounted pages abort their active read and ignore late results.
- Acceptance safety: the form rejects a second submission while acceptance is uncertain. Timeouts release the button without claiming success and direct the customer to reload the frozen proposal before retrying, allowing the idempotent server record to surface.
- Verification: one stalled-load and one stalled-acceptance component path bring the suite to 401 passing tests across 69 files. Formatting, lint, 321-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 81-file production artifact audit, zero-vulnerability runtime audit, 94-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded and ordered Settings loading preview

- Preview: `https://6aa7f95b8017690ce4a59f54--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa7f95b8017690ce4a59f54`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Settings recovery: subscription, plans, company profile, integration readiness, deletion status, and import history now use the shared fifteen-second request boundary and fail together with actionable refresh guidance instead of publishing a partial administrative view.
- Tenant-switch safety: starting a Settings load clears the previous workspace's company, billing, integration, deletion, and import values. Monotonic request identities prevent a late response from the previously selected company from overwriting the active workspace.
- Verification: one stalled-read and one workspace-ordering component path bring the suite to 399 passing tests across 69 files. Formatting, lint, 321-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded preserved-lead import preview

- Preview: `https://6aa7f091354566b9fffd536c--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa7f091354566b9fffd536c`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Preserved-lead recovery: the owner-only legacy migration now bounds client initialization and session retrieval to fifteen seconds and server import plus response parsing to forty-five seconds under the shared Settings mutation lock.
- Duplicate safety: an uncertain timeout releases both confirmation controls, does not claim records were added, and directs the owner to refresh Leads before repeating the idempotent import.
- Verification: one Settings component path brings the suite to 397 passing tests across 69 files. Formatting, lint, 321-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded prototype-import recovery preview

- Preview: `https://6aa7dba88b185518563889f3--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa7dba88b185518563889f3`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Import recovery: original-CRM file reading, client initialization, session retrieval, server validation/commit/rollback, response parsing, and recent-batch refresh now use explicit fifteen- or forty-five-second request boundaries.
- Outcome clarity: validation timeouts confirm that no records were imported. Uncertain commit or rollback timeouts direct managers to refresh history before retrying, and confirmed mutations remain reported as complete if the following history refresh fails.
- Verification: one Settings component path brings the suite to 396 passing tests across 69 files. Formatting, lint, 321-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, and 93-file preview artifact audit passed. Exact deployed browser smoke passed on retry after one transient Netlify network-idle timeout.

## 2026-09-14 bounded verified workspace export preview

- Preview: `https://6aa7b323cfe1370d57f650a9--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa7b323cfe1370d57f650a9`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Export recovery: owner/admin workspace exports now bound Supabase initialization and session retrieval to fifteen seconds, with forty-five-second boundaries for archive generation, download, and SHA-256 verification.
- File safety: the shared Settings mutation lock prevents overlapping exports or admin writes. Any timeout releases the control and explicitly reports that no file was saved; the browser still creates a download only after the complete archive passes its server-issued digest check.
- Verification: one Settings component path brings the suite to 395 passing tests across 69 files. Formatting, lint, 321-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded billing handoff preview

- Preview: `https://6aa7ab14940d5071be26238a--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa7ab14940d5071be26238a`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Billing recovery: Checkout and Customer Portal handoff now bound Supabase initialization, session retrieval, the authenticated server request, and response parsing to fifteen seconds.
- Duplicate safety: the shared Settings mutation lock prevents concurrent plan or Portal requests. An uncertain timeout releases every billing control and directs the manager to refresh before retrying.
- Verification: one Settings component path and one admin-error mapping case bring the suite to 394 passing tests across 69 files. Formatting, lint, 321-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded account-deletion actions preview

- Preview: `https://6aa7a2e1e0de31ce5a1ee83f--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa7a2e1e0de31ce5a1ee83f`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Deletion recovery: owner-only deletion requests and grace-period cancellations now bound client initialization and their durable RPC to fifteen seconds under the shared Settings mutation lock.
- Duplicate safety: uncertain timeouts release every affected control and direct the owner to refresh Settings before repeating either action. Confirmed requests and cancellations retain their existing explicit outcomes.
- Verification: two Settings component paths and one admin-error mapping group bring the suite to 392 passing tests across 69 files. Formatting, lint, 321-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded company-profile writes preview

- Preview: `https://6aa79a98185ce447faf1818c--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa79a98185ce447faf1818c`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Settings recovery: company-profile saves and proposal-logo uploads, attachment, and removal now bound client initialization and durable Supabase or Storage writes to fifteen seconds under the shared Settings mutation lock.
- Outcome clarity: uncertain timeouts direct managers to refresh before retrying. A confirmed company save remains reported as saved if the following workspace refresh stalls, preventing a duplicate durable write.
- Verification: two Settings component paths and one timeout-mapping group bring the suite to 389 passing tests across 69 files. Formatting, lint, 321-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 customer estimate-link clipboard recovery preview

- Preview: `https://6aa7913a185ce415ecf18157--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa7913a185ce415ecf18157`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Clipboard recovery: copying a generated customer estimate link now uses the shared fifteen-second request boundary. Denied, unavailable, or stalled clipboard access releases the control without claiming success, while the visible link remains selected and available for manual copying.
- Verification: one commercial-panel component path brings the suite to 386 passing tests across 68 files. Formatting, lint, 320-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded customer estimate links preview

- Preview: `https://6aa7890c607b7970fa633e5c--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa7890c607b7970fa633e5c`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Link recovery: customer estimate-link requests and response parsing now use the shared fifteen-second boundary, and one link request may run at a time. Other durable commercial actions remain locked while a link is being generated.
- Secret-link safety: uncertain timeouts require a refresh before replacement, while a confirmed link remains visible and copyable if the following financial refresh fails.
- Verification: one commercial-panel component path brings the suite to 385 passing tests across 68 files. Formatting, lint, 320-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded core commercial writes preview

- Preview: `https://6aa78109f6f826c0503f243b--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa78109f6f826c0503f243b`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Commercial-write recovery: estimate creation and status changes, accepted-estimate invoice creation, and payment recording now bound Supabase initialization and durable writes to fifteen seconds under the shared commercial mutation lock.
- Duplicate safety: uncertain timeouts tell the user to refresh before repeating a durable financial action. Confirmed estimate, invoice, status, and payment writes retain their completed state and show distinct guidance if the following commercial refresh fails.
- Verification: two commercial-panel component paths and one timeout-mapping group bring the suite to 384 passing tests across 68 files. Formatting, lint, 320-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded commercial document reads preview

- Preview: `https://6aa778bef6f82698013f2393--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa778bef6f82698013f2393`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Document recovery: estimate and invoice previews now share bounded account, job, customer, property, branding, and line-item reads. A missing, rejected, partial, or stalled request releases every preview control with safe retry guidance instead of remaining in a loading state.
- Ordering safety: one document request may run at a time, and changing jobs invalidates any outstanding document response and closes documents from the previous job.
- Verification: one commercial-panel component path brings the suite to 381 passing tests across 68 files. Formatting, lint, 320-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded commercial record reads preview

- Preview: `https://6aa76eff423cb6580f5b54f4--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa76eff423cb6580f5b54f4`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Commercial recovery: estimate, invoice, and estimate-default reads now bound Supabase initialization and the combined query set to fifteen seconds. A missing, rejected, partial, or stalled result leaves the last complete commercial view intact and reports a retryable safe message.
- Ordering safety: every commercial load uses a monotonic request identity. A late failure from the previously selected job cannot replace the financial state of the job now open.
- Verification: two commercial-panel component paths bring the suite to 380 passing tests across 68 files. Formatting, lint, 320-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded job file operations preview

- Preview: `https://6aa76546d8321b2ca911460f--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa76546d8321b2ca911460f`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- File-operation recovery: authenticated client setup and file-record writes now use the shared fifteen-second request boundary, while binary uploads have a forty-five-second transfer boundary. Signed-download preparation is bounded and locked so repeated clicks cannot create overlapping signed-link requests.
- Duplicate safety: an uncertain file-record timeout preserves the uploaded object and directs the user to refresh before retrying, avoiding deletion of a file whose record may still commit. Confirmed metadata failures use a bounded best-effort object cleanup, and every upload/download control releases after failure.
- Verification: four Jobs component paths and expanded timeout mapping bring the suite to 378 passing tests across 68 files. Formatting, lint, 320-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded job workflow writes preview

- Preview: `https://6aa7551bdace99364d2623d7--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa7551bdace99364d2623d7`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Workflow recovery: job stage, note, and checklist writes now bound Supabase initialization and database work to fifteen seconds. Stage and note actions share the job mutation lock; checklist updates retain their item-specific lock.
- Duplicate safety: each uncertain timeout directs the user to refresh before repeating the durable write. A confirmed note is cleared and remains acknowledged if its following detail refresh fails.
- Verification: four Jobs component paths bring the suite to 374 passing tests across 68 files. Formatting, lint, 320-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit after one transient registry DNS retry, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded core job writes preview

- Preview: `https://6aa73670cfe1376faaf650aa--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa73670cfe1376faaf650aa`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Job-write recovery: job creation and assignment now bound Supabase initialization and database work to fifteen seconds and share the existing job mutation lock.
- Duplicate safety: uncertain timeouts direct users to refresh before repeating a create or assignment. Confirmed creation closes and clears its form and remains acknowledged if the following job-list refresh fails.
- Verification: three Jobs component paths and one timeout-mapping assertion bring the suite to 370 passing tests across 68 files. Formatting, lint, 320-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, and exact deployed browser smoke passed.

## 2026-09-14 bounded job reads preview

- Preview: `https://6aa72e58dcefc04a6c3205f5--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa72e58dcefc04a6c3205f5`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Job recovery: job, customer, active-location, and teammate loading plus checklist, note, and file detail loading now share the fifteen-second request boundary. Missing, stalled, and partial reads release their loading states without publishing incomplete data.
- Ordering safety: job-list and job-detail requests use monotonic request identities, and silent automatic refreshes preserve the last complete view instead of replacing it with loading placeholders.
- Verification: four Jobs component paths bring the suite to 366 passing tests across 68 files. Formatting, lint, 320-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-14 bounded customer communication writes preview

- Preview: `https://6aa725eef91990e1a91a00f9--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa725eef91990e1a91a00f9`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Communication recovery: do-not-contact creation and lifting plus consent and revocation evidence now bound Supabase initialization and database writes to fifteen seconds. Independent preference and consent locks prevent overlapping submissions.
- Duplicate safety: uncertain timeouts use action-specific guidance to refresh before repeating durable compliance writes. Confirmed do-not-contact changes remain acknowledged when their following detail refresh fails.
- Verification: four Customers component paths and one safe-error group bring the suite to 362 passing tests across 67 files. Formatting, lint, 319-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-14 bounded customer merge preview

- Preview: `https://6aa71d55d68ee8f9e7175337--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa71d55d68ee8f9e7175337`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Merge recovery: the destructive duplicate-customer merge now bounds Supabase initialization and its atomic database RPC to fifteen seconds and participates in the customer mutation lock.
- Duplicate safety: an uncertain timeout warns that the records may still be merged and directs the manager to refresh before retrying. A confirmed merge closes the source record and remains acknowledged even if the following customer-list refresh fails.
- Verification: two Customers component paths and one safe-error assertion bring the suite to 357 passing tests across 67 files. Formatting, lint, 319-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-14 bounded service-location writes preview

- Preview: `https://6aa71454f0b7218b1d3168d6--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa71454f0b7218b1d3168d6`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Location-write recovery: service-location creation, editing, archival, and reactivation now bound Supabase initialization and database work to fifteen seconds and participate in the shared customer mutation lock.
- Duplicate safety: uncertain timeouts warn that the location change may still complete before another attempt is allowed. Confirmed location changes retain their completed state and show distinct recovery guidance if the following detail refresh fails.
- Verification: four Customers component paths bring the suite to 354 passing tests across 67 files. Formatting, lint, 319-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-14 bounded core customer writes preview

- Preview: `https://6aa70383a06f6a28192eee25--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa70383a06f6a28192eee25`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Customer-write recovery: atomic customer creation and customer assignment now bound Supabase initialization and database work to fifteen seconds. One customer mutation lock prevents overlapping create, assignment, location, and merge controls.
- Duplicate safety: timeouts warn that the customer or assignment may still be saved and require a refresh before retry. A confirmed customer creation remains closed and is reported as completed even if the following customer-list refresh fails.
- Verification: three Customers component paths and one timeout-mapping group bring the suite to 350 passing tests across 67 files. Formatting, lint, 319-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-14 bounded customer reads preview

- Preview: `https://6aa6fb2d423cb6209a5b5537--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa6fb2d423cb6209a5b5537`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Customer recovery: customer-list and assignable-teammate loading plus locations, linked jobs, active suppressions, and consent history share the fifteen-second request boundary. Missing, stalled, and partial requests always release loading without publishing an incomplete detail view.
- Ordering safety: every list and detail request has a monotonic identity, closing the drawer invalidates its outstanding work, and only the latest selected customer can update detail state. Silent background refreshes no longer replace the drawer with loading placeholders.
- Verification: five Customers component paths bring the suite to 346 passing tests across 67 files. Formatting, lint, 319-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 bounded notification updates preview

- Preview: `https://6aa6f269008e57547d48d422--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa6f269008e57547d48d422`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Notification recovery: mark-all-read now bounds Supabase initialization and the tenant-scoped update to fifteen seconds. The control remains locked while its outcome is uncertain and always releases afterward.
- Duplicate safety: a timeout warns that notifications may still have been marked read and directs the user to refresh before retrying; confirmed writes update the local notification state only after the database response succeeds.
- Verification: one notification mutation path brings the suite to 341 passing tests across 66 files. Formatting, lint, 318-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 bounded dashboard reads preview

- Preview: `https://6aa6ea4d7b73060d562ec7ee--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa6ea4d7b73060d562ec7ee`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Overview recovery: lead totals, today's appointments, pipeline, activity, and notifications share the fifteen-second request boundary. Initial failures show a retryable unavailable state instead of zero performance, partial loads are rejected, and a background failure preserves the last complete dashboard.
- Search recovery: customer, job, and call search shares the same boundary and always leaves its loading state. Failed search is distinguished from a valid no-match result.
- Verification: four Dashboard component paths bring the suite to 340 passing tests across 66 files. Formatting, lint, 318-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 bounded reporting requests preview

- Preview: `https://6aa6e172185ce488d0f1814f--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa6e172185ce488d0f1814f`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Reporting recovery: Supabase initialization and all six 30-day report sources now use the shared fifteen-second request boundary. Missing or stalled requests release the calculating state, and partial query failures never replace a complete report.
- Accuracy safety: an unavailable initial report does not present zeroes as measured business performance, and CSV export remains disabled until every source succeeds.
- Verification: four Reports component paths bring the suite to 336 passing tests across 65 files. Formatting, lint, 317-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 bounded task-board requests preview

- Preview: `https://6aa6d8ad607b790316633de0--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa6d8ad607b790316633de0`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Task recovery: tasks, assignable teammates, open jobs, and active leads plus task creation and completion now use the shared fifteen-second request boundary.
- Duplicate safety: one mutation lock disables task writes while a result is uncertain. Timeout guidance directs users to refresh before retrying, while a confirmed creation followed by a failed task-list refresh is reported as completed.
- Verification: five Task component paths bring the suite to 332 passing tests across 64 files. Formatting, lint, 316-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 bounded scheduling requests preview

- Preview: `https://6aa6c8a5f6f826215e3f2327--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa6c8a5f6f826215e3f2327`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Scheduling recovery: upcoming appointments, customers, open jobs, and assignable teammates plus appointment creation, status, and assignment now use the shared fifteen-second request boundary.
- Duplicate safety: one mutation lock disables schedule writes while a result is uncertain. Timeout guidance directs dispatchers to refresh before retrying, while a confirmed booking followed by a failed calendar refresh is reported as completed.
- Verification: six Schedule component paths and one timeout-mapping case bring the suite to 327 passing tests across 63 files. Formatting, lint, 315-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 bounded lead-inbox requests preview

- Preview: `https://6aa6bfc41250a0ce6fbc6f7a--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa6bfc41250a0ce6fbc6f7a`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Lead recovery: the lead list and assignable-teammate query plus manual creation, status, assignment, and atomic customer/job conversion now use the shared fifteen-second request boundary.
- Duplicate safety: one mutation lock disables all lead writes while their result is uncertain. Timeout guidance directs sales users to refresh before retrying, while confirmed creation or conversion followed by a failed refresh is reported as completed.
- Verification: seven Leads component paths and one timeout-mapping case bring the suite to 320 passing tests across 62 files. Formatting, lint, 314-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 bounded receptionist-console requests preview

- Preview: `https://6aa6b6c106b9dd61e5b76a4d--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa6b6c106b9dd61e5b76a4d`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Receptionist recovery: call history, assignable teammates, configuration, and monthly usage now load within the shared fifteen-second request boundary. Background refreshes retain the existing view instead of replacing it with a loading screen.
- Cost and duplicate safety: settings writes and call assignments share one mutation lock and the fifteen-second boundary. Real provider-backed test calls receive forty-five seconds; an uncertain timeout directs the manager to wait for call history before retrying.
- Verification: five receptionist-console component paths and one timeout-mapping case bring the suite to 312 passing tests across 61 files. Formatting, lint, 313-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 bounded Lead Engine requests preview

- Preview: `https://6aa6ad643e51c8f7896a6a1e--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa6ad643e51c8f7896a6a1e`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Lead Engine recovery: profile/run health, provider readiness, profile creation, and schedule toggles now use the shared fifteen-second request boundary. Manual provider-backed scans receive a forty-five-second UI deadline.
- Cost and duplicate safety: one profile mutation lock and the existing scan lock prevent conflicting work. Timeout guidance says the mutation or provider scan may still finish and directs managers to refresh or inspect history before retrying. Successful creation followed by refresh failure remains distinct.
- Verification: six Lead Engine component paths and one timeout-mapping case bring the suite to 306 passing tests across 60 files. Formatting, lint, 312-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 bounded team-administration requests preview

- Preview: `https://6aa6a38f2ef630fd85973b2b--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa6a38f2ef630fd85973b2b`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Team recovery: the initial member/subscription load and owner/admin invitation, role, activation, and cancellation requests now share the fifteen-second request boundary. One mutation lock disables all team controls while a write is uncertain, preventing duplicate or conflicting changes.
- Outcome clarity: timeouts explicitly warn that the requested mutation may still complete and direct the manager to refresh before retrying. A confirmed invitation remains visible and copyable if the following team refresh fails; confirmed member and cancellation changes are likewise distinguished from refresh failure.
- Verification: six team component paths and one timeout-mapping case bring the suite to 299 passing tests across 59 files. Formatting, lint, 311-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 latest-response workspace selection preview

- Preview: `https://6aa69a3d008e576a3448d42b--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa69a3d008e576a3448d42b`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Selection ordering: every membership/entitlement load receives a monotonic request identity. Starting a newer refresh or selecting another company invalidates the older request, and only the latest result may update workspace, options, role, entitlements, error, or loading state.
- Multi-company recovery: choosing another company invalidates in-flight background work immediately and presents the loading state until that selection is resolved. Re-selecting the already active company is a no-op, avoiding an invalidated request without a replacement.
- Verification: a deterministic component race completes an older company request after the newer selection and proves Bontraco remains in the chosen company. The suite now passes 292 tests across 58 files, plus formatting, lint, 310-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke.

## 2026-09-13 bounded signed-in workspace access preview

- Preview: `https://6aa6587cdcefc0be4e3205c1--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa6587cdcefc0be4e3205c1`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Access recovery: signed-in membership lookup and all four entitlement checks now share a fifteen-second request boundary. An unavailable client, rejected query, or stalled request releases the company-loading screen with sanitized guidance and an explicit retry action.
- Subscription safety: any failed entitlement RPC now fails the workspace bootstrap instead of silently treating the provider outage as an unsubscribed company and showing incorrect billing guidance. Silent periodic refresh failures preserve the last usable workspace.
- Verification: five workspace-provider paths bring the suite to 291 passing tests across 58 files. Formatting, lint, 310-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 bounded owner-workspace creation preview

- Preview: `https://6aa649ead8321bfce51145c7--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa649ead8321bfce51145c7`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Creation recovery: owner onboarding now bounds Supabase client initialization and the atomic `create_bontraco_account` RPC with the shared fifteen-second deadline. A stalled or unavailable request releases the form and warns that the workspace may still be created, directing the owner to wait and refresh before retrying.
- Post-create recovery: membership refresh is separately bounded. If creation completed but refresh fails, Bontraco explicitly says the workspace exists and asks for a reload rather than misreporting creation failure or encouraging a duplicate.
- Verification: four onboarding component paths and one timeout mapping bring the suite to 286 passing tests across 57 files. Formatting, lint, 309-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 bounded team-invitation acceptance preview

- Preview: `https://6aa642f36ef7b03b7c5709dc--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa642f36ef7b03b7c5709dc`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Invitation recovery: authenticated invitation acceptance now bounds Supabase client initialization and the tenant-safe acceptance RPC with the shared fifteen-second auth deadline. Success clears the stored invitation token, refreshes membership, and enters the company workspace.
- Failure behavior: a stalled request leaves the verification screen with explicit “may still finish” guidance, an unavailable client receives safe connection guidance, and unknown invitation/provider details remain non-enumerating. A post-acceptance refresh failure no longer misreports a completed invitation as rejected.
- Verification: three invitation component paths and one invitation-network sanitizer case bring the suite to 281 passing tests across 56 files. Formatting, lint, 308-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 bounded user-authentication requests preview

- Preview: `https://6aa63de3423cb632495b54fb--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa63de3423cb632495b54fb`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Request recovery: login, signup, password-reset email, password update, and sign-out now share a fifteen-second UI deadline around client initialization and the complete provider request. A stalled request releases its busy control and warns that the action may still finish before the user retries.
- Sign-out safety: both workspace sign-out controls share one in-flight guard, display progress, and surface only stable guidance if the operation fails. The guidance explicitly states that the session remains active, and the rejected request is handled instead of reaching the browser as an unhandled promise.
- Verification: five focused deadline and safe-message tests bring the suite to 277 passing tests across 55 files. Formatting, lint, 307-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 80-file production artifact audit, zero-vulnerability runtime audit, 93-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 bounded initial-session recovery preview

- Preview: `https://6aa6357de0de31e8371ee7f5--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa6357de0de31e8371ee7f5`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Auth recovery: the application now subscribes immediately to Supabase's initial auth-state event instead of waiting on a separate session request before registering its listener. An unavailable client, failed subscription, or stalled initialization releases the login screen after an eight-second safety deadline with no backend detail.
- Lifecycle safety: a successful auth event clears the deadline and restores its session, while unmounting clears both the timer and subscription. This prevents an outage from trapping public auth routes behind the indefinite “Preparing your workspace” state without weakening authenticated workspace or RLS enforcement.
- Verification: four focused auth-provider tests bring the suite to 272 passing tests across 54 files. Formatting, lint, 305-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 81-file production artifact audit, zero-vulnerability runtime audit, configured production auth-gate browser smoke, 94-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 repository source secret-audit preview

- Preview: `https://6aa62d95940d5068142622ff--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa62d95940d5068142622ff`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Source protection: `verify:release` now scans all tracked and pending repository files while excluding ignored dependency and build output. It recognizes Groq, Tavily, Stripe, Supabase, and Google-style secret values and reports only affected paths, never credential contents.
- Fixture hardening: synthetic credential cases are assembled only at test runtime, so the test source does not normalize storing recognizable secret-shaped examples.
- Verification: two focused repository-audit tests bring the suite to 268 passing tests across 53 files. Formatting, lint, 304-file repository audit, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 81-file production artifact audit, zero-vulnerability runtime audit, production auth-gate browser smoke, 94-file preview artifact audit, local sample browser smoke, and exact deployed browser smoke passed.

## 2026-09-13 migration inventory gate preview

- Preview: `https://6aa61ee6b05d02d2249629c6--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa61ee6b05d02d2249629c6`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Migration gate: `verify:release` now audits all 82 migration files for normalized 14-digit versions and names, unique versions and descriptions, non-empty content, unresolved conflict markers, and deprecated `auth.role()` authorization.
- Scope boundary: the inventory audit protects repository determinism and current authorization syntax but does not assert that the unavailable target project has applied every migration; that remains an explicit live release gate.
- Verification: three focused migration-audit tests bring the suite to 266 passing tests across 52 files. Formatting, lint, 82-file migration audit, 33-file SQL suite audit, normal and explicit production TypeScript/Vite builds, 81-file production artifact audit, zero-vulnerability runtime audit, 94-file preview audit, and exact deployed browser suite passed.

## 2026-09-13 SQL suite rollback-safety gate preview

- Preview: `https://6aa61866dace990b20262381--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa61866dace990b20262381`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Repository gate: `verify:release` now audits all 33 SQL integration files before production artifact verification. It rejects reduced coverage, non-normalized or duplicate names, missing transaction boundaries, missing failure assertions, rollback before begin, and any committed fixture path.
- Scope boundary: this is structural safety evidence, not a substitute for executing the suites. Live execution could not be repeated because this workspace is no longer linked, Docker is unavailable, and the previously documented Bontraco project is not visible to the currently authenticated Supabase CLI account.
- Verification: two focused audit tests bring the suite to 263 passing tests across 51 files. Formatting, lint, normal and explicit production TypeScript/Vite builds, 33-file SQL structure audit, 81-file production artifact audit, zero-vulnerability runtime audit, 94-file preview audit, and exact deployed browser suite passed.

## 2026-09-13 mandatory production-artifact release gate preview

- Preview: `https://6aa610fe9a24fc5e38756554--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa610fe9a24fc5e38756554`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Release enforcement: `verify:release` now compiles a second artifact with `VITE_DEMO_MODE=false` and audits that exact output with `CONTEXT=production`. Because GitHub CI already runs the release command, pull requests and main-branch pushes inherit the mandatory gate without duplicated workflow logic.
- Regression protection: a focused test reads the package command graph and requires the explicit demo-disabled Vite build, production audit context, and release-command binding.
- Verification: all 261 tests across 50 files, formatting, lint, normal and explicit production TypeScript/Vite builds, both artifact audits over 81 production files, zero-vulnerability runtime audit, production auth-gate browser smoke, local sample browser suite, 94-file preview audit, and exact deployed browser suite passed.

## 2026-09-13 complete production fixture isolation preview

- Preview: `https://6aa60ac9cfe13797baf651ea--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa60ac9cfe13797baf651ea`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Fixture isolation: Customers list/detail records and Jobs operational and commercial records moved into three final dynamic modules reachable only with the compile-time preview flag. The estimate/invoice component test now explicitly models that build flag instead of relying on an implicit test environment.
- Production proof: the complete `VITE_DEMO_MODE=false` build passes the production-context artifact gate across all 81 application and server files. No compiled route contains the guarded demo identifiers, sample-account emails, preview company identity, or sample-workspace marker.
- Preview acceptance: the deploy-preview build emits all isolated sample modules and passes artifact auditing over 94 files. Its exact URL passed the complete all-section, responsive, accessibility, recovery, customer, job, estimate, invoice, download, and public-route browser suite.
- Verification: all 260 tests across 50 files, formatting, lint, TypeScript/Vite builds, production artifact audit, preview artifact audit, zero-vulnerability runtime audit, local browser suite, and exact deployed browser suite passed.

## 2026-09-13 Leads and Settings fixture extraction preview

- Preview: `https://6aa602f07b730651342ec7c4--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa602f07b730651342ec7c4`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Fixture isolation: Leads sample records and assignees plus Settings plans, company configuration, subscription, and integration summaries moved into two dynamic modules reachable only with the compile-time preview flag. Time-relative fixture values are constructed only when a preview requests the module.
- Production proof: a `VITE_DEMO_MODE=false` build emits neither fixture module, and the production fixture gate now identifies only Customers and Jobs for continued extraction.
- Async acceptance: the browser gate now waits for the first dynamically populated plan before validating all Settings seat limits and sample configuration. The exact preview then passed the complete all-section and public-route suite.
- Verification: all 260 tests across 50 files, formatting, lint, TypeScript/Vite build, production fixture probe, preview artifact audit over 91 files, zero-vulnerability runtime audit, local browser suite, and exact deployed browser suite passed.

## 2026-09-13 Calls, Tasks, and Schedule fixture extraction preview

- Preview: `https://6aa5fb988d14e257a583c615--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5fb988d14e257a583c615`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Fixture isolation: Calls and receptionist summaries, Tasks and related records, and Schedule appointments and selectors moved into three dynamic modules reachable only with the compile-time preview flag. Time-relative fixture values are constructed only when a preview requests the module.
- Production proof: a `VITE_DEMO_MODE=false` build emits none of the three fixture modules, and the production fixture gate now identifies only Customers, Jobs, Leads, and Settings for continued extraction.
- Verification: all 260 tests across 50 files, formatting, lint, TypeScript/Vite build, production fixture probe, preview artifact audit over 89 files, zero-vulnerability runtime audit, local browser suite, and exact deployed browser suite passed.

## 2026-09-13 Reports, Lead Engine, and Team fixture extraction preview

- Preview: `https://6aa5edae2ef6300029973c22--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5edae2ef6300029973c22`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Fixture isolation: Reports sample metrics, Lead Engine profiles and scan runs, and Team members and invitations moved into three dynamic modules reachable only with the compile-time preview flag. Time-relative fixture values are constructed only after a preview requests the module.
- Production proof: the production-mode build emitted none of the three fixture modules; Reports remained clean, while Lead Engine and Team disappeared from the production fixture-gate findings. Seven route assets remain intentionally blocked for continued extraction.
- Async acceptance: the browser gate now waits for the dynamically populated Lead Engine `Run now` control before testing its disabled sample state. The exact preview then passed the complete all-section and public-route suite.
- Verification: all 260 tests across 50 files, formatting, lint, TypeScript/Vite build, production fixture probe, preview artifact audit over 86 files, zero-vulnerability runtime audit, local browser suite, and exact deployed browser suite passed.

## 2026-09-13 production-shell demo extraction preview

- Preview: `https://6aa5e6fcf0b74e291c8b7781--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5e6fcf0b74e291c8b7781`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Fixture isolation: the preview company identity and all Overview sample metrics, pipeline, activity, notifications, search results, badges, and receptionist summary moved into two dynamic modules reachable only when the compile-time demo flag is enabled. Type-only imports preserve the application contracts without pulling fixture values into production.
- Production proof: a `VITE_DEMO_MODE=false` build emitted neither demo module and the production-context artifact gate no longer identified the entry or Dashboard assets. It still rejected nine lazy CRM section assets, so production remains safely blocked while the extraction continues.
- Preview acceptance: the deploy-preview build emitted the isolated `workspace` and `dashboard` fixture chunks, then passed the exact all-section, responsive, accessibility, recovery, download, and public-route browser suite with the same sample experience.
- Verification: all 260 tests across 50 files, formatting, lint, TypeScript/Vite builds, preview artifact audit over 83 files, zero-vulnerability runtime audit, local browser suite, and exact deployed browser suite passed.

## 2026-09-13 production demo-fixture gate preview

- Preview: `https://6aa5df92dcefc0c228320512--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5df92dcefc0c228320512`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Promotion boundary: artifact auditing now receives the real Netlify deployment context. In production it rejects compiled demo identifiers, sample-account emails, the preview company identity, and the sample-workspace marker; audit output identifies only affected assets and never prints the detected fixture value. Development and deploy-preview builds intentionally retain the sample workspace.
- Fail-closed proof: running the completed artifact audit with `CONTEXT=production` rejected every current browser asset containing a recognized demo fixture. This intentionally preserves the unchecked release requirement until those fixtures are extracted from the production build instead of relying only on an unreachable runtime branch.
- Verification: 4 new preview/production and value-redaction assertions bring the suite to 260 passing tests across 50 files. Formatting, lint, TypeScript/Vite build, 81-file preview artifact audit, zero-vulnerability runtime audit, and the exact deployed browser suite passed.

## 2026-09-13 workspace section failure-recovery preview

- Preview: `https://6aa5da20aebd839792d6733e--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5da20aebd839792d6733e`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Resilience: a section-scoped React error boundary now prevents a failed lazy chunk or unexpected section render from replacing the whole application. The workspace navigation remains available, and the user receives plain retry and Return to Overview actions. Moving to another section resets the local failure state.
- Failure acceptance: a separate clean browser context deliberately aborts the Leads module request, verifies the inline `Leads could not load` recovery view and intact workspace navigation, then returns successfully to Overview. This runs locally and against the exact deployed preview.
- Performance: the 64,615-byte authenticated shell and 968,626-byte aggregate browser JavaScript remain below both enforced mobile budgets.
- Verification: all 256 tests across 50 files, formatting, lint, TypeScript/Vite build, 81-file deployment audit, zero-vulnerability runtime audit, local browser suite, and exact deployed browser suite passed.

## 2026-09-13 intent-based CRM section prefetch preview

- Preview: `https://6aa5d173d51fa86c4046eba6--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5d173d51fa86c4046eba6`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Interaction loading: focusing, approaching, or pressing a CRM navigation item starts its existing lazy module request before activation. This covers keyboard, mouse, pen, and touch users without preloading hidden role-restricted routes or returning to the former eager-load cost. A failed speculative request does not disrupt the current page; actual navigation retains the normal lazy-loading path.
- Acceptance: the browser gate focuses Leads while Overview is active, waits for the Leads asset to arrive, and proves preloading did not navigate. It then completes the existing all-section, responsive, accessibility, keyboard, dialog, download, and public-route suite.
- Performance: the authenticated shell is 62,909 bytes and total browser JavaScript is 966,920 bytes, remaining comfortably below the enforced 350 KiB individual and 1,100 KiB aggregate limits.
- Verification: all 254 tests across 49 files, formatting, lint, TypeScript/Vite build, 81-file deployment audit, zero-vulnerability runtime audit, local browser suite, and exact deployed browser suite passed.

## 2026-09-13 on-demand CRM section loading preview

- Preview: `https://6aa5c4e4008e5797f848d422--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5c4e4008e5797f848d422`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Mobile loading: onboarding and all ten non-overview CRM sections now load on demand. The authenticated shell chunk dropped from 310,244 bytes to 62,434 bytes, an 80% reduction; the largest individual script is now the 174,544-byte shared React dependency instead of the complete workspace application. Scoped loading states keep the surrounding navigation and workspace shell stable while a section arrives.
- Async acceptance: the permanent browser gate now waits for each lazy section's exact heading before checking titles, document structure, accessibility, responsive overflow, and the 200%-equivalent layout. The first preview run correctly caught the former synchronous assumption; the corrected full deployed run passed every section.
- Verification: all 254 tests across 49 files, formatting, lint, TypeScript/Vite build, 81-file deployment audit, zero-vulnerability runtime audit, and the exact deployed browser suite passed.

## 2026-09-13 mobile JavaScript performance-budget preview

- Preview: `https://6aa5bc2b31deb2da5772f29a--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5bc2b31deb2da5772f29a`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Performance boundary: the mandatory deployment audit now rejects any individual browser script above 350 KiB or aggregate browser JavaScript above 1,100 KiB. The current largest route is 310,244 bytes and total browser JavaScript is 956,972 bytes, leaving explicit regression headroom while protecting mobile loading cost.
- Verification: individual and aggregate budget failures passed within 254 tests across 49 files. Formatting, lint, the TypeScript/Vite production build, deployment audit over 60 files, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-13 serverless-source credential audit preview

- Preview: `https://6aa5b59288403e19e197cba8--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5b59288403e19e197cba8`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Deployment boundary: the mandatory artifact audit now scans all 35 browser output files plus all 25 Netlify function and shared-source files before bundling or upload. A recognizable hardcoded provider/backend credential in either deployment surface fails closed without printing its value.
- Verification: the new serverless-source case passed within 252 tests across 49 files. Formatting, lint, the TypeScript/Vite production build, deployment audit over 60 files, runtime audit with zero known vulnerabilities after a transient npm DNS retry, and the exact deployed all-section browser suite passed.

## 2026-09-13 complete-asset audit and stable test-pool preview

- Preview: `https://6aa5b2b5c9bb54d43090fdb9--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5b2b5c9bb54d43090fdb9`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Artifact coverage: the secret scanner now reads every deployed file rather than only common text extensions, so recognizable credentials hidden in SVG, font, image, or other asset types also block a build. A non-code asset regression case passed without exposing the fixture value.
- Test reliability: Vitest now uses isolated VM threads instead of starting one operating-system fork per test file. This eliminated repeated worker-start timeouts while retaining per-file isolation; all 251 tests across 49 files passed in 2.04 seconds on the final verified run.
- Verification: formatting, lint, the TypeScript/Vite production build, complete-asset audit over 35 deployed files, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-13 Netlify production-preflight enforcement preview

- Preview: `https://6aa5a196185ce401ecf181b2--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5a196185ce401ecf181b2`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Promotion boundary: Netlify's production context now runs `npm run preflight:production` before `npm run build`. A production deploy therefore stops before compilation and upload when demo mode, required credentials, provider configuration, Supabase project matching, purge safety, or the on-call endpoint fail validation; deploy previews retain their separate sample-mode command.
- Verification: the Netlify production-command binding passed within 250 tests across 49 files. Formatting, lint, the TypeScript/Vite production build, browser-artifact audit over 35 files, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 fail-closed browser artifact audit preview

- Preview: `https://6aa59b1231cf6ba4fa19554f--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa59b1231cf6ba4fa19554f`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Build boundary: every local, CI, and Netlify `npm run build` now audits the completed browser `dist` tree before deployment. Source-map files, embedded source-map references, and recognizable Groq, Tavily, Stripe, Supabase secret, and Google API-key formats fail the build without echoing the detected value.
- Verification: safe-artifact, source-map, inline-source-map, and six secret-format cases passed within 249 tests across 49 files. The deployed Netlify log shows the artifact audit passing for all 35 browser files before upload; formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite also passed.

## 2026-09-12 browser-verified account export preview

- Preview: `https://6aa593b83dd492303155a9d8--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa593b83dd492303155a9d8`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Download integrity: Settings reads the exact response bytes, independently computes their SHA-256 with browser Web Crypto, and compares it with `x-bontraco-sha256` before creating the download. A missing, malformed, or mismatched digest stops the download and tells the user that no file was saved.
- Verification: valid, missing, malformed, and mismatched checksum cases passed within 241 tests across 48 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 SHA-256-bound account export preview

- Preview: `https://6aa58d20a06f6a783b2eee65--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa58d20a06f6a783b2eee65`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Artifact integrity: the exact serialized JSON attachment is hashed with SHA-256 before release. The same digest is stored in the tenant-scoped `account_exported` audit event and returned in the `x-bontraco-sha256` response header, so operators can verify the downloaded bytes and use that verified digest in purge metadata.
- Verification: deterministic hashing and audit/response binding passed within 238 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 safe workspace identity export preview

- Preview: `https://6aa5859ee0de3143c11ee7d3--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5859ee0de3143c11ee7d3`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Multi-user coverage: each unique workspace membership now resolves to a safe Auth identity record containing only user ID, email, account creation, last sign-in, and email-confirmation timestamps. This makes role rows identifiable in the owner/admin export.
- Privacy boundary: phone numbers, authentication providers, application metadata, user metadata, tokens, password state, and users outside the selected workspace are excluded. A missing tenant-member identity fails the whole export instead of returning an ambiguous partial user list.
- Verification: deduplication, safe projection, metadata exclusion, and identity-read failure passed within 237 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 credential-safe invitation export preview

- Preview: `https://6aa57e7c8dda5724d8139d6a--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa57e7c8dda5724d8139d6a`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Export coverage: tenant invitations now appear in the owner/admin account export with ID, email, role, inviter, expiration, acceptance, and creation timestamps. They use the same paging, response-size, and audit gates as other tenant data.
- Credential boundary: invitation `token_digest` values remain server-only and are excluded by an explicit allowlist; the invitations table is still omitted from the general `select *` export list.
- Verification: the explicit invitation projection and credential exclusion passed within 235 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 checksum-bound purge exports preview

- Preview: `https://6aa57752875c3aa1e1f75eee--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa57752875c3aa1e1f75eee`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- JSON evidence: `export_verified: true` is no longer sufficient by itself; final purge approval also requires a valid 64-character SHA-256 artifact checksum in `export_sha256`.
- Private-file evidence: when registered files exist, `file_export_verified: true` must be accompanied by an exact current `file_export_count` and a valid SHA-256 manifest checksum in `file_export_manifest_sha256`.
- Verification: invalid JSON checksum plus missing and complete private-file evidence cases passed within 234 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 private-file purge gate preview

- Preview: `https://6aa5703d983dd217531fe87b--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5703d983dd217531fe87b`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- File-preservation gate: when registered private files exist, the purge worker now requires `metadata.file_export_verified: true` before Stripe, Retell, Storage, or database cleanup begins. Workspaces without registered files do not require the extra evidence.
- Failure boundary: missing file-export evidence produces only `Private file export is not verified; operator review required`; provider, Storage, and database details remain suppressed.
- Verification: empty, unverified-file, verified-file, and safe-message cases passed within 233 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 bounded account-export payload preview

- Preview: `https://6aa5698be275bb8f34c7c796--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5698be275bb8f34c7c796`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Response integrity: the final UTF-8 JSON attachment is serialized and measured before its audit event is written. Payloads above 5.5 MB fail with the existing generic export error, leaving margin beneath Netlify's documented 6 MB buffered request/response limit.
- Platform evidence: [Netlify Functions configuration limits](https://docs.netlify.com/build/functions/configuration/) documents the non-configurable 6 MB buffered payload ceiling.
- Verification: normal serialization and multibyte oversize-refusal cases passed within 232 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 fail-closed account-export audit preview

- Preview: `https://6aa5621950d7dcee418fdf0f--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5621950d7dcee418fdf0f`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Audit integrity: the account-export endpoint now verifies that its tenant-scoped activity event was persisted before returning the JSON attachment. A failed audit write returns the existing generic export failure instead of an unaudited successful response.
- Privacy boundary: raw database failure text remains server-side, while successful records retain the export timestamp and empty truncation list.
- Verification: successful and failed audit-write cases passed within 230 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 complete bounded account export preview

- Preview: `https://6aa55b7131deb2d79472f257--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa55b7131deb2d79472f257`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Export completeness: every tenant table is read in explicit 1,000-row pages. If a table reaches the 50,000-row serverless safety boundary, the endpoint now fails closed instead of returning a successful JSON download with partial rows.
- Compatibility: successful version-one exports retain `truncated_tables: []`; oversized workspaces require a reviewed operator export path rather than an owner-visible partial artifact.
- Verification: complete multi-page and limit-refusal cases passed within 228 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 purge claim revalidation preview

- Preview: `https://6aa5545b983dd2729e1fe897--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa5545b983dd2729e1fe897`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Claim integrity: the atomic `approved` to `processing` transition now returns the current account, schedule, and approval metadata. The worker revalidates that returned evidence before making provider or deletion calls, rather than relying only on the earlier queue snapshot.
- Revocation behavior: if an operator changes or revokes required approval evidence before the claim, the worker records a durable failed state with generic operator-review guidance and performs no destructive cleanup.
- Verification: the new changed-approval claim case passed within 226 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 post-grace purge approval preview

- Preview: `https://6aa54cd9e0cb0e963bf06a85--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa54cd9e0cb0e963bf06a85`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Approval boundary: the purge worker now rejects approval evidence timestamped before the request's 14-day `scheduled_for` boundary, even when the request was manually changed to `approved` and is due when processed.
- Verification: the new pre-grace approval case passed within 225 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 verified account-purge transitions preview

- Preview: `https://6aa546a081648ba7b86c09af--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa546a081648ba7b86c09af`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Transition integrity: a failure or completion write must return the exact deletion-request row while it is still `processing`. A database response with no error but no matching row is now treated as a failed transition instead of a successful purge result.
- Completion evidence: the preserved deletion request receives one explicit `completed` transition only after provider, Storage, and workspace deletion finish; the worker refuses to report completion when that transition cannot be confirmed.
- Verification: two new matched-row and missing-row cases passed within 224 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 sanitized account-purge failures preview

- Preview: `https://6aa53ef250d7dcee1b8fdf2a--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa53ef250d7dcee1b8fdf2a`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Failure boundary: owner-visible deletion-request `last_error`, scheduled responses, and structured purge logs now contain only approved configuration, automated-limit, or generic operator-review categories. Unknown provider, database, schema, policy, token, and response-body text is suppressed.
- State integrity: if the sanitized `failed` transition cannot be persisted, the worker throws a stable internal failure instead of returning a false failed result while the request remains `processing`.
- Verification: three new failure-mapping and persistence cases passed within 222 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 stale account-purge claim recovery preview

- Preview: `https://6aa537fef0b721b6df3168dd--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa537fef0b721b6df3168dd`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Recovery boundary: an account-deletion request left in `processing` for more than one hour is moved to `failed` with generic operator-review guidance. Recovery never resumes deletion, calls a provider, or changes pending/approved requests.
- Observability: the failure update refreshes `updated_at`, so the five-minute monitor queues the recovered request as a critical, aggregate-only incident. If recovery itself cannot be written, the purge worker fails safely.
- Verification: two stale-claim recovery cases passed within 219 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 account-purge failure monitoring preview

- Preview: `https://6aa530b8cfe1378271f650a0--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa530b8cfe1378271f650a0`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Monitor coverage: the five-minute operations worker now queries recently failed account-deletion purges alongside failed lead scans, billing webhooks, and urgent calls. Each purge failure receives a deterministic critical incident fingerprint for deduplication.
- Privacy boundary: the internal purge incident carries an empty payload, and external delivery remains aggregate-only with incident/severity counts and the oldest timestamp—no workspace, requester, customer, or deletion-error content.
- Verification: the existing operations-monitor suites now cover purge fingerprinting, severity, empty internal payload, and aggregate external counts within 217 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 clean-worktree release gate

- Verified commit: `0d86848`; `git status --porcelain` returned no entries before the gate.
- Code gate: formatting, lint, all 217 tests across 47 files, and the TypeScript/Vite production build passed from the clean worktree.
- Dependency gate: `npm audit --omit=dev` reported zero known production vulnerabilities.
- Rollback baseline: Netlify site `5f8cdc98-3c9f-4b7e-b473-2dd7eb75b7b9` reports published production deploy `6a85fed5609c570dc008fb52`; no production promotion was performed.
- Latest immutable browser evidence remains deploy `6aa522a550d7dc232a8fdf0f`, whose complete all-section suite passed.

## 2026-09-12 fail-closed call reconciliation preview

- Preview: `https://6aa522a550d7dc232a8fdf0f--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa522a550d7dc232a8fdf0f`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Provider-spend boundary: hourly reconciliation must successfully query both completed calls and already-recorded usage before constructing the Retell client or retrieving provider records. A failed usage-ledger read returns one stable `500` rather than assuming every call is missing and making up to 50 unnecessary provider requests.
- Existing-record behavior: an already-recorded usage ID produces zero provider retrieval calls and remains idempotent.
- Verification: two direct scheduled-handler cases passed within 217 tests across 47 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 fail-closed receptionist test calls preview

- Preview: `https://6aa51c019db8fbadbd65637d--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa51c019db8fbadbd65637d`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Pre-spend safety: authentication, workspace membership, suppression, receptionist settings, and daily-cap queries must all succeed before Retell is called. A failed cap query no longer behaves as a zero count, so provider spend cannot bypass the five-call daily limit during a database outage.
- Post-start safety: provider failures return stable approved guidance. If Retell starts a call but CRM tracking fails, the endpoint returns `202` with `tracked: false`; the UI reports that history is delayed and explicitly says not to retry, preventing duplicate outbound calls.
- Verification: six new server/UI message cases passed within 215 tests across 46 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 receptionist call-timing boundary preview

- Preview: `https://6aa514df17e04499bda13281--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa514df17e04499bda13281`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Timing boundary: Retell lifecycle and appointment-booking handlers accept only finite numeric millisecond provider timestamps. Invalid types, non-finite values, and an end before the start return one stable `400` before Supabase initialization or writes.
- Preserved behavior: valid start/end values produce deterministic ISO timestamps and rounded duration; a legitimately omitted start timestamp still uses server receipt time.
- Verification: ten normalization and direct-handler cases passed within 209 tests across 45 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 receptionist settings-outage boundary preview

- Preview: `https://6aa50dc37c8217a99e44dee1--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa50dc37c8217a99e44dee1`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Settings boundary: Retell lifecycle, appointment-booking, intake-guidance, and transfer-destination handlers no longer interpret a failed Supabase settings query as a disabled or unmapped receptionist. Database failures return one stable public-safe `500`; successful empty queries retain their existing configuration-specific `409` behavior.
- Call safety: transient database outages can now trigger provider retry/fallback handling instead of incorrectly telling a caller that transfer or workspace configuration is absent.
- Verification: four direct handler tests suppress private database text and prove the retryable response within 199 tests across 44 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 durable receptionist webhook acknowledgement preview

- Preview: `https://6aa50691fa36418c5684eccb--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa50691fa36418c5684eccb`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Durable acknowledgement: analyzed Retell deliveries receive `200` only after the call row, metering row, and lifecycle event are stored. Failed usage or event upserts return stable public-safe `500` responses so the provider can retry instead of silently losing billing or audit evidence.
- Retry safety: call, usage, and event writes retain their existing conflict keys, so a retry upserts the same records rather than duplicating them.
- Verification: three direct persistence-path tests cover usage failure, event failure, and complete success within 195 tests across 43 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 signed receptionist payload boundary preview

- Preview: `https://6aa4ff91c9bb5472eb90fbc5--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4ff91c9bb5472eb90fbc5`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Ingress boundary: Retell call lifecycle, appointment booking, intake guidance, and transfer-destination handlers verify the provider signature first, then accept only valid JSON objects. Empty, malformed, null, array, string, and numeric bodies receive one stable 400 response before Supabase initialization or writes.
- Direct handler evidence: all four malformed signed-payload tests prove exactly one signature check, the stable response body, and zero database-client creation.
- Verification: eleven new parsing and direct-handler cases passed within 192 tests across 42 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed all-section browser suite passed.

## 2026-09-12 safe server-function error responses preview

- Preview: `https://6aa4f234b05d02a86e9629bb--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4f234b05d02a86e9629bb`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Server boundary: prototype import commit/rollback, receptionist appointment booking, and call reconciliation no longer return caught Supabase, Postgres, provider, schema, token, or source-record details. Failed import batches also persist only a stable public-safe failure message.
- Approved guidance: known appointment time-window, duration, title, phone, and stale-call validation remains actionable; unexpected booking, import, and reconciliation failures collapse to stable recovery messages.
- Verification: four new focused boundary tests passed within 181 tests across 41 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, the production-style authentication gate, and the exact deployed all-section browser suite passed.

## 2026-09-12 safe owner-administration errors preview

- Preview: `https://6aa4ea8fc9bb54de5790fec8--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4ea8fc9bb54de5790fec8`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Owner-administration boundary: billing Checkout/Portal, workspace export, import validation/commit/rollback, preserved-lead import, and deletion request/cancellation no longer render raw function, Supabase, Postgres, policy, schema, constraint, archive, or database text. Approved plan availability, role, session, JSON/file-size, import-state, exact-confirmation, and pending-deletion guidance remains specific.
- Failure recovery: thrown billing and export requests now use `try/finally`, so offline or network failures always clear the busy state and allow a safe retry.
- Verification: seven focused admin-operation error groups passed within 177 tests across 40 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed browser suite passed.

## 2026-09-12 safe public estimate-acceptance errors preview

- Preview: `https://6aa4e397423cb67f545b54f2--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4e397423cb67f545b54f2`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Public customer boundary: missing, malformed, expired, revoked, closed, database-failed, and unconfigured estimate links use non-enumerating guidance. Only approved signer-name, optional-email, acknowledgment, and connection guidance remains specific; unknown function, Supabase, Postgres, policy, schema, constraint, and database text is suppressed.
- Server defense: the anonymous acceptance endpoint no longer returns raw Postgres exception messages for rejected acceptance RPCs. The customer page independently maps every load and acceptance failure, providing defense in depth if a server response changes.
- Verification: six new focused error groups passed within 170 tests across 39 files, including server helpers and the customer acceptance component. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed browser suite passed.

## 2026-09-12 safe Lead Engine errors preview

- Preview: `https://6aa4dc9dfa36417a4384ecc5--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4dc9dfa36417a4384ecc5`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Lead Engine boundary: profile creation, schedule toggling, manual scan startup, and scan-history failures no longer render raw Supabase, Postgres, RLS, provider, or server response text. Approved plan, profile-limit, duplicate-name, field-validation, provider-readiness, session, authorization, cooldown, and daily-limit guidance remains actionable; missing and inaccessible profiles use the same response.
- Collector persistence: future Tavily, Google Places, timeout, credential, quota, configuration, and database failures store only bounded operational summaries. The UI also defensively maps preexisting unknown scan-history text before display.
- Verification: six new focused error groups passed within 164 tests across 38 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed browser suite passed.

## 2026-09-12 safe onboarding errors preview

- Preview: `https://6aa4d531607b79fd20633d37--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4d531607b79fd20633d37`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Onboarding boundary: duplicate workspace names, existing memberships, invalid company names, expired sessions, and offline requests retain actionable guidance while unknown `create_bontraco_account` RPC, Postgres, schema, constraint, and policy details are suppressed.
- Browser-gate hardening: public-route navigation now waits for a visible application landmark and exact page heading instead of total network idleness, preventing unrelated background traffic from creating false release failures without weakening the page-readiness assertion.
- Verification: five focused onboarding-error tests passed within 158 tests across 37 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed browser suite passed.

## 2026-09-12 safe company-settings errors preview

- Preview: `https://6aa4ce813e51c8339d6a69c5--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4ce813e51c8339d6a69c5`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Settings boundary: company-profile, proposal-default, logo-upload, logo-attachment, and logo-removal failures no longer render raw Supabase, Postgres, policy, schema, constraint, or Storage messages. Approved workspace identity, contact, service-area, routing, branding, and estimate-default validation remains specific.
- Verification: five focused settings-error tests passed within 153 tests across 36 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed browser suite passed.

## 2026-09-12 safe commercial-workflow errors preview

- Preview: `https://6aa4c73aaebd83d6cad673f3--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4c73aaebd83d6cad673f3`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Commercial-workflow boundary: estimate creation and status, accepted-estimate invoice conversion, customer-link creation, and payment recording no longer render raw Supabase, Postgres, policy, schema, constraint, or server messages. Approved estimate input and status guidance remains specific; missing and unauthorized customer-share records use the same non-enumerating response.
- Verification: five focused commercial-error tests passed within 148 tests across 35 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed browser suite passed.

## 2026-09-12 safe receptionist-call errors preview

- Preview: `https://6aa4c0495a330dbc4ce4bc3d--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4c0495a330dbc4ce4bc3d`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Call-workflow boundary: receptionist settings and call assignment no longer render raw Supabase or Postgres messages. Test calls show only an explicit allowlist of approved server guidance, unknown responses fall back safely, thrown network requests clear the busy state, and users receive a connection-aware retry message.
- Verification: five focused call-error tests passed within 143 tests across 34 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed browser suite passed.

## 2026-09-12 safe schedule and task errors preview

- Preview: `https://6aa4b8f89db8fbfd036563a9--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4b8f89db8fbfd036563a9`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Shared-work boundary: appointment creation, status, and assignment plus task creation and completion/reopening no longer render raw Supabase or Postgres messages. Every failure now identifies the attempted action and directs the user to review or refresh before retrying.
- Verification: five focused work-planning error tests passed within 138 tests across 33 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed browser suite passed.

## 2026-09-12 safe job-workflow errors preview

- Preview: `https://6aa4b1ed7b7306195f2ec80f--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4b1ed7b7306195f2ec80f`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Job-workflow boundary: job creation, assignment, stage changes, notes, checklist completion, private file upload/metadata registration, and signed download preparation no longer render raw Supabase, Storage, or Postgres messages. Local file size and content-type validation remains specific and unchanged.
- Verification: eight focused job-error tests passed within 133 tests across 32 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed browser suite passed.

## 2026-09-12 safe customer-workflow errors preview

- Preview: `https://6aa4abda423cb62d5f5b557a--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4abda423cb62d5f5b557a`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Customer-workflow boundary: customer creation and assignment plus service-location creation, editing, archival, and reactivation no longer render raw Supabase or Postgres messages. Approved first-name, field-length, and paired address/city validation remain; missing and unauthorized service locations share one non-enumerating response.
- Verification: six focused customer-error tests passed within 125 tests across 31 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed browser suite passed.

## 2026-09-12 safe lead-workflow errors preview

- Preview: `https://6aa4a409e0cb0e2cdef06ab7--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4a409e0cb0e2cdef06ab7`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Lead-workflow boundary: manual creation, status changes, assignment, and conversion no longer render raw Supabase or Postgres messages. Missing customer name and negative-value conversion errors retain safe, actionable guidance; missing and access-denied leads share one non-enumerating response; unknown backend details map to stable action-specific recovery instructions.
- Verification: six focused lead-error tests passed within 119 tests across 30 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed browser suite passed.

## 2026-09-12 safe team-management errors preview

- Preview: `https://6aa49cecfa3838fb9b77be5e--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa49cecfa3838fb9b77be5e`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Team-administration boundary: invitation creation, teammate role/access updates, and invitation cancellation no longer render raw Supabase or Postgres messages. Duplicate invitations, plan user limits, and inactive-subscription conditions retain specific guidance; unknown backend details are replaced with stable recovery instructions.
- Verification: four focused team-error tests passed within 113 tests across 29 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed browser suite passed.

## 2026-09-12 complete-report export guard preview

- Preview: `https://6aa495c19e2cb97c1aa0a9b1--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa495c19e2cb97c1aa0a9b1`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Reporting safety: CSV export is disabled while the initial report is being calculated and whenever any source query fails, preventing zero or partial figures from being presented as a complete report. The failure is announced as an alert, and a later successful refresh clears it and re-enables export.
- Verification: three focused export-state tests passed within 109 tests across 28 files. Formatting, lint, the TypeScript/Vite production build, runtime audit with zero known vulnerabilities, and the exact deployed browser suite—including a real CSV download and content check—passed.

## 2026-09-12 report CSV download preview

- Preview: `https://6aa48833c2d4c64b32354a79--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa48833c2d4c64b32354a79`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Reporting workflow: the 30-day report exporter now uses a deterministic CSV generator, spreadsheet-compatible line endings, an explicit UTF-8 CSV media type, and an ISO-dated Bontraco filename. The temporary browser download element and object URL are cleaned up after activation.
- Verification: two focused CSV tests passed within 106 tests across 28 files. The local and exact deployed browser suites performed a real download, verified its filename, read the file, and confirmed representative lead metrics. Formatting, lint, the TypeScript/Vite production build, and the runtime audit also passed with zero known vulnerabilities.

## 2026-09-12 guest-only authentication routes preview

- Preview: `https://6aa480bac9bb545cd890fba4--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa480bac9bb545cd890fba4`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Session boundary: Bontraco waits for Supabase session restoration before deciding whether to show login, signup, or forgot-password screens. An authenticated user is redirected to the workspace instead of being allowed to replace the active identity. The password-update route remains outside this guard because a valid recovery link intentionally creates a temporary authenticated recovery session.
- Verification: three focused guard-state tests passed within 104 tests across 27 files. Formatting, lint, the TypeScript/Vite production build, zero-vulnerability runtime audit, local demo browser suite, production-mode auth gate, and the exact deployed browser suite passed.

## 2026-09-12 safe authentication errors preview

- Preview: `https://6aa479d4aebd8302e3d67302--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa479d4aebd8302e3d67302`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Error boundary: login, signup, password recovery/update, and invitation acceptance convert Supabase, network, and database failures into stable user guidance. Unknown backend messages are not rendered, while local password mismatch, credential, verification, password-strength, rate-limit, expired-reset, connection, and invitation-email cases remain actionable.
- Verification: eight focused sanitizer tests passed within 101 tests across 26 files. Formatting, lint, the TypeScript/Vite production build, zero-vulnerability runtime audit, and the complete local and exact deployed browser suites passed. Real email delivery and authenticated completion remain separate launch-domain acceptance gates.

## 2026-09-12 route and workspace titles preview

- Preview: `https://6aa473553e51c87d1145d3--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa473553e51c87d1145d3`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Navigation context: marketing, login, signup, password-reset request, password update, invitation, and customer-estimate routes now set a descriptive document title. The workspace title updates with the active CRM section and company name, so browser history, tabs, and assistive technology distinguish the user’s current context.
- Verification: the permanent browser gate checks the exact title on all seven public routes, Overview, and all ten CRM sections. The complete local and deployed browser suites passed together with formatting, lint, 93 tests across 25 files, the TypeScript/Vite production build, and a zero-vulnerability runtime audit.

## 2026-09-12 public account-flow matrix preview

- Preview: `https://6aa46b7bd8321b877d1145d3--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa46b7bd8321b877d1145d3`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Public-flow gate: browser acceptance now visits marketing, login, signup, password-reset request, password update, missing-token invitation, and unavailable customer-estimate routes. Every screen must retain one visible main landmark and H1, continuous heading levels, unique DOM IDs, named navigation and controls, and no horizontal overflow at 360, 390, 430, 768, 1280, and 1440 pixels. The unavailable estimate must still avoid echoing its secret token.
- Verification: the expanded route matrix passed locally and on the exact draft URL together with formatting, lint, 93 tests across 25 files, the TypeScript/Vite production build, and a zero-vulnerability runtime audit. Real email delivery, invitation acceptance, and password-reset completion remain explicit launch-domain acceptance gates.

## 2026-09-12 all-section responsive-matrix preview

- Preview: `https://6aa464f9e0de312ee21ee7d7--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa464f9e0de312ee21ee7d7`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Responsive gate: browser acceptance now traverses all ten CRM sections at each standard viewport width—360, 390, 430, 768, 1280, and 1440 pixels—and rejects horizontal overflow or loss of the section heading. Mobile navigation targets are scrolled into view before real pointer activation, matching the horizontally scrollable navigation available to users. The separate all-section 640×450 200%-equivalent reflow matrix remains active.
- Verification: the expanded matrix passed locally and on the exact draft URL together with formatting, lint, 93 tests across 25 files, the TypeScript/Vite production build, and a zero-vulnerability runtime audit. Native browser-zoom and physical-device review remain manual launch gates.

## 2026-09-12 interactive-control naming preview

- Preview: `https://6aa45a83940d5062712622e1--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa45a83940d5062712622e1`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Accessibility gate: browser acceptance now rejects every visible button, link, input, select, or textarea that lacks naming evidence from an explicit ARIA label/reference, associated HTML label, visible text, image alternative, control value, or title.
- Verification: all visible interactive controls across Overview and all ten CRM sections passed locally and on the exact draft URL. The complete local and deployed browser suites passed together with formatting, lint, 93 tests across 25 files, TypeScript/Vite production build, and a zero-vulnerability runtime audit. Manual screen-reader listening remains a launch gate.

## 2026-09-12 workspace document-structure preview

- Preview: `https://6aa44f143dd492691a55a7a9--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa44f143dd492691a55a7a9`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Accessibility gate: Overview and every CRM section now fail browser acceptance if they expose anything other than one visible main landmark and one H1, skip a heading level, duplicate a DOM ID, or leave a visible navigation landmark unnamed.
- Verification: all eleven workspace views passed the permanent structure audit locally and on the exact draft URL. The complete local and deployed browser suites passed together with formatting, lint, 93 tests across 25 files, TypeScript/Vite production build, and a zero-vulnerability runtime audit. Manual screen-reader, native browser-zoom, and physical-device review remain launch gates.

## 2026-09-11 SPA section-announcement preview

- Preview: `https://6aa4476c423cb613c65b5506--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4476c423cb613c65b5506`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Accessibility change: SPA section changes now update one screen-reader-only `aria-live="polite"` and `aria-atomic="true"` status. The announcement reports the selected section without stealing focus from navigation, search results, notifications, or dashboard actions.
- Verification: the pinned keyboard gate activates Leads, waits for the exact `Leads section loaded` status, and confirms the visible Leads control becomes the unique current page. The complete local and deployed browser suites passed together with formatting, lint, 93 tests across 25 files, TypeScript/Vite production build, and a zero-vulnerability runtime audit. Actual announcement listening with a screen reader remains a manual launch gate.

## 2026-09-11 assistive workspace navigation preview

- Preview: `https://6aa4407d3e51c821cf6a6a05--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4407d3e51c821cf6a6a05`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Accessibility change: the authenticated workspace now starts with a visually hidden skip link that becomes visible on focus and moves focus to the main workspace region. The active visible navigation control exposes `aria-current="page"`, giving keyboard and assistive-technology users a deterministic bypass and location signal.
- Verification: the pinned browser gate proves the skip link is the first Tab stop, has a visible focus indicator, focuses the main region on Enter, and leaves exactly one visible current-page control. The complete local and deployed browser suites passed together with formatting, lint, 93 tests across 25 files, TypeScript/Vite production build, and a zero-vulnerability runtime audit. Manual screen-reader, native browser-zoom, and physical-device review remain launch gates.

## 2026-09-11 modal keyboard accessibility preview

- Preview: `https://6aa43e0b6ef7b0996c57095f--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa43e0b6ef7b0996c57095f`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Accessibility change: all eleven CRM dialogs share focus entry, forward/reverse Tab containment for the topmost modal, and focus restoration to the opener. Nested estimate and invoice previews retain their own modal boundary without interfering with the job-details dialog underneath.
- Verification: the pinned browser gate proves focus enters the task dialog, Tab and Shift+Tab wrap inside it, Escape closes it, and focus returns to **New task**. The complete local and deployed browser suites passed together with formatting, lint, 93 tests across 25 files, TypeScript/Vite production build, and a zero-vulnerability runtime audit. Manual screen-reader, native browser-zoom, and physical-device review remain launch gates.

## 2026-09-11 200%-equivalent reflow preview

- Preview: `https://6aa42b42f0b74e46b48b7651--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa42b42f0b74e46b48b7651`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Reflow evidence: a 1280×900 display at 200% zoom exposes a 640×450 CSS viewport. The pinned browser gate now visits Customers, Leads, Lead Engine, Jobs, Schedule, Tasks, Calls, Reports, Team, and Settings at that exact viewport, rejecting horizontal overflow or loss of the section heading. Native browser shortcuts do not change zoom inside the headless automation session, so native manual zoom remains a launch-review item.
- Verification: the expanded browser smoke passed both locally and against the draft, while retaining the six standard widths, keyboard-only flow, focus visibility, reduced motion, console, route, document, and disabled-sample-mutation checks. Formatting, lint, 93 tests across 25 files, TypeScript/Vite production build, and runtime audit passed with zero known production vulnerabilities. The existing 33-suite database baseline is unchanged because this milestone adds browser acceptance coverage only.

## 2026-09-11 actionable assignment-notification preview

- Preview: `https://6aa4249b8dda570551139c3a--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa4249b8dda570551139c3a`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Recipient workflow: assignment alerts now read their tenant-safe `source_table` metadata and route the recipient to the matching Customers, Leads, Jobs, Schedule, Tasks, or Calls section. Unknown metadata fails safely by closing the alert without navigating. No record details or identifiers were added to the client query.
- Verification: formatting, lint, 93 tests across 25 files, TypeScript/Vite production build, and runtime audit passed with zero known production vulnerabilities. The deployed browser smoke opens the assignment alert, selects it, confirms the Leads heading, and retains every existing keyboard, responsive, accessibility, console, commercial-document, and disabled-sample-mutation gate. The existing 33-suite database baseline is unchanged because this slice is client-only.
- Separate blocked rehearsal: a temporary real signed-file harness was attempted using the connected Netlify environment, but the stored `SUPABASE_SERVICE_ROLE_KEY` is incomplete/redacted. It stopped before fixture creation, and the unverified harness code was removed. The complete server-only key must be reconnected before the real signed-upload/download acceptance can run.

## 2026-09-11 private job-collaboration preview

- Preview: `https://6aa421d7983dd206141fe87c--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa421d7983dd206141fe87c`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Storage hardening: private uploads must use the exact `workspace/job/file` path shape and the caller must be allowed to access that job. Malformed paths and another representative's job fail closed. The uploader may authorize Storage API removal of an orphan object when metadata creation fails; existing metadata-backed author and manager cleanup remains.
- Role evidence: an assigned sales user can create and read a private job note, file metadata, and its Storage object authorization. An unrelated sales user and an independent outside tenant cannot retrieve the known note, metadata, or object IDs. The workspace owner retains operational access.
- Database evidence: migration `harden_job_file_storage` is recorded on Supabase project `eyhrfxyfqqtuwxjcwxbw`. All 33 rollback-safe live-schema SQL suites passed together. Security advisors retain the two documented warning groups with no new warning/error finding; performance advisors contain only existing informational notices.
- Application evidence: the note and file controls now have explicit accessible names. Formatting, lint, 93 tests across 25 files, TypeScript/Vite production build, and runtime audit passed with zero known production vulnerabilities. The deployed browser smoke verifies the sample private note, attachment, disabled note/upload/download mutations, keyboard flow, and every existing console, accessibility, and six-width responsive gate. One later marketing-page navigation initially timed out at `networkidle`; a direct HTTP 200 check and clean full-suite retry passed.

## 2026-09-10 keyboard workflow preview

- Preview: `https://6aa30ea179462c7675fc95a8--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa30ea179462c7675fc95a8`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Keyboard behavior: the deployed gate starts from page load and uses Tab plus Enter to reach the Leads navigation and open the section. It then reaches workspace search by keyboard, types and finds a customer, clears results with Escape, tabs to notifications, opens them with Enter, and dismisses the popover with Escape. The notification trigger now exposes its closed state through `aria-expanded=false` after dismissal.
- Verification: formatting, lint, 93 tests across 25 files, TypeScript/Vite production build, and runtime audit passed with zero known production vulnerabilities. The full deployed browser smoke also retained every route, console, reduced-motion, accessible-name, responsive-overflow, commercial-document, and disabled-sample-mutation gate. The existing 32-suite database baseline is unchanged because this slice modifies only keyboard interaction and browser acceptance coverage.
- Preview availability note: the first automated browser navigation timed out at the Netlify draft hostname. A direct HTTP check returned 200, and a clean browser retry passed the complete suite.

## 2026-09-10 private assignment-notification preview

- Preview: `https://6aa30a4eef7ff835c0dae4b8--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa30a4eef7ff835c0dae4b8`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Notification behavior: assigning a customer, lead, job, appointment, task, or receptionist call creates exactly one in-app notification for the new assignee. It includes the record type and label without exposing contact details, records the assigning actor in private metadata, and intentionally creates nothing for an unassignment or repeated no-op save.
- Database evidence: migration `notify_record_assignments` is recorded on Supabase project `eyhrfxyfqqtuwxjcwxbw`. All 32 rollback-safe live-schema SQL suites passed together. The assignment suite proves six-source coverage, exact recipient and actor metadata, dispatcher denial, unrelated-user denial, and cross-tenant isolation. Advisors reported no new warning or error-level finding.
- Application evidence: formatting, lint, 93 tests across 25 files, TypeScript/Vite production build, and runtime audit passed with zero known production vulnerabilities. The deployed browser smoke opens the unread notification, verifies its assignment title and record label, and passes every existing section, console, accessibility, and six-width responsive gate. The first browser launch timed out before DOM load; a direct HTTP 200 check and clean retry passed the complete suite.

## 2026-09-10 cross-record assignment audit preview

- Preview: `https://6aa3039e0cb91a0ea30d8093--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa3039e0cb91a0ea30d8093`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Audit behavior: each real assignee change on a lead, customer, job, appointment, task, or receptionist call creates exactly one tenant-scoped activity with the source record, prior assignee, new assignee, actor, and timestamp. Repeated no-op saves create no event. Managers retain workspace visibility; newly assigned sales or field users see only events linked to records they can now access. Unassigned staff and outside tenants see none.
- Database evidence: migration `audit_record_assignments` is recorded on Supabase project `eyhrfxyfqqtuwxjcwxbw`. All 32 rollback-safe live-schema SQL suites passed together. The new suite proves all six source types, exact event counts, no-op suppression, assigned-user visibility, unrelated-user denial, and cross-tenant isolation. Security advisors reported zero error-level findings and no new assignment-audit warning; the two existing warning-level notices remain unchanged.
- Application evidence: formatting, lint, 93 tests across 25 files, TypeScript/Vite production build, and runtime audit passed with zero known production vulnerabilities. The deployed browser smoke confirms the dashboard assignment event and every existing section, console, accessibility, and six-width responsive gate.

## 2026-09-10 role-safe receptionist-call routing preview

- Preview: `https://6aa2a69f83768105e8369d0c--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa2a69f83768105e8369d0c`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Call workflow: owners/admins/dispatchers can assign or unassign receptionist calls directly from call history. Only active call-authorized owners, admins, dispatchers, and sales users are selectable; field-only teammates are excluded. Sales retains assigned-only call visibility and cannot reroute a call.
- Database evidence: migration `call_assignments` is recorded on Supabase project `eyhrfxyfqqtuwxjcwxbw`. Its column-scoped grant allows browser clients to update only `assigned_to`, while RLS and the existing same-workspace foreign key enforce manager authority, active membership, permitted roles, and tenant isolation. All 31 rollback-safe SQL suites passed; advisors reported zero error-level findings and no new call-assignment warning.
- Application evidence: formatting, lint, 93 tests across 25 files, TypeScript/Vite production build, and runtime audit passed with zero known production vulnerabilities. The deployed browser smoke confirms the correct call assignee, disabled sample mutation, exclusion of field-only options, and every existing section, console, accessibility, and six-width responsive gate.

## 2026-09-10 private team-change audit preview

- Preview: `https://6aa29f34ee24a90a0da8a4a4--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa29f34ee24a90a0da8a4a4`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Audit behavior: each successful membership role or active-state change records one tenant-scoped activity with the acting user, target user, prior state, new state, and timestamp. Team events appear in manager dashboard activity and are hidden from dispatcher, sales, field, anonymous, and outside-tenant sessions.
- Database evidence: migration `audit_team_changes` is recorded on Supabase project `eyhrfxyfqqtuwxjcwxbw`. All 30 rollback-safe SQL suites passed; the team suite proves exact event counts, forbidden attempts produce no event, owner visibility, and dispatcher/outside-tenant denial. Advisors reported zero error-level findings and no new audit-specific warning.
- Application evidence: formatting, lint, 93 tests across 25 files, TypeScript/Vite production build, and runtime audit passed with zero known production vulnerabilities. The deployed browser smoke confirms the Team audit disclosure and all existing section, accessibility, console, and six-width responsive gates.

## 2026-09-10 connected lead-to-paid workflow acceptance

- Review preview: `https://6aa295d4733f11b0123c07fe--abundant-solutions-crm-20260817.netlify.app/app`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Connected workflow: an assigned sales user creates and converts a fresh lead into its customer and job, with assignment preserved across the chain, then creates a validated multi-line estimate. The owner dispatches an appointment to field staff, accepts the estimate, creates the invoice, and records its successful full payment. The assigned field user confirms only the dispatched appointment.
- Role evidence: sales cannot record payments, field cannot read commercial documents, unrelated sales cannot see any connected record, and an independent outside tenant cannot retrieve the known lead, appointment, or invoice identifiers.
- Verification: the new rollback-only acceptance suite passed against Supabase project `eyhrfxyfqqtuwxjcwxbw`, and all 30 live-schema SQL suites passed together. The prior preview’s formatting, lint, 93 tests across 25 files, production build, zero-vulnerability runtime audit, and deployed six-width browser smoke remain current because this milestone adds acceptance coverage without changing the application bundle or production data.

## 2026-09-10 protected team-management hierarchy preview

- Preview: `https://6aa295d4733f11b0123c07fe--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa295d4733f11b0123c07fe`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Team workflow: owners can promote and manage admins or staff. Admins can manage sales, dispatcher, and field users but cannot deactivate themselves, alter owners or other admins, or invite another admin. Sample-mode role, activation, invitation, and cancellation controls are visibly disabled.
- Database evidence: migration `harden_team_management` is recorded on Supabase project `eyhrfxyfqqtuwxjcwxbw`. Membership writes are limited to the `role` and `active` columns, invitation updates are closed to browser clients, and RLS enforces the owner/admin hierarchy. All 29 rollback-safe SQL suites passed; the new suite proves staff deactivation/reactivation, owner-only admin promotion, immutable identity fields, self/owner/peer protection, lower-role admin invitations, and cross-workspace isolation. Advisors reported no new error-level security or performance finding.
- Application evidence: formatting, lint, 93 tests across 25 files, the TypeScript/Vite production build, and the runtime dependency audit passed with zero known production vulnerabilities. The deployed browser smoke verified owner promotion choices, disabled sample mutations, all workspace sections, and the six-width overflow/console/accessibility gates.

## 2026-09-10 manager customer-assignment preview

- Preview: `https://6aa25a59655a7cee17814280--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa25a59655a7cee17814280`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Customer workflow: owners/admins/dispatchers can assign or unassign an active teammate directly from each customer card. The selected assignee is also visible in customer details. Sales users retain assigned-only customer visibility and cannot move a customer to another teammate.
- Database evidence: migration `bontraco_customer_assignments` is recorded on Supabase project `eyhrfxyfqqtuwxjcwxbw`. It adds a same-workspace membership foreign key for customer assignments. All 28 rollback-safe SQL suites passed; the new suite proves dispatcher assignment, assigned-sales visibility, sales reassignment denial, unrelated-sales hiding, and cross-tenant isolation. Advisors reported no new disabled-RLS, anonymous-access, or unindexed-foreign-key finding.
- Application evidence: formatting, lint, 93 tests across 25 files, the TypeScript/Vite production build, and the runtime dependency audit passed with zero known production vulnerabilities. The deployed browser smoke confirms the expected customer assignee in both the customer card and details, sample mutation is disabled, and every existing section, console, accessibility, and six-width overflow gate still passes.

## 2026-09-09 manager appointment-dispatch preview

- Preview: `https://6aa2040bc7c9694b35134c84--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa2040bc7c9694b35134c84`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Calendar workflow: owners/admins/dispatchers can assign or unassign an active teammate while creating an appointment or directly from the Schedule. Every appointment displays its assignee. Sales users keep self-assigned creation and assigned-only visibility; field users can update an assigned appointment’s status but no longer see an unusable creation control.
- Database evidence: migration `bontraco_appointment_assignments` is recorded on Supabase project `eyhrfxyfqqtuwxjcwxbw`. It adds a same-workspace membership foreign key, covering assignment index, and an update policy that prevents sales/field cross-assignment. All 27 rollback-safe SQL suites passed. The new suite proves manager dispatch, assigned-field visibility/status updates, field creation and reassignment denial, unrelated-sales hiding, and cross-tenant isolation. Advisors reported no new disabled-RLS, anonymous-access, or unindexed-foreign-key finding.
- Application evidence: formatting, lint, 93 tests across 25 files, the TypeScript/Vite production build, and the runtime dependency audit passed with zero known production vulnerabilities. The deployed browser smoke confirms the correct appointment assignee, disabled sample mutation, all workspace sections, and the six-width overflow/console/accessibility gates.

## 2026-09-09 manager job-assignment preview

- Preview: `https://6aa1fd2f181c5d5dd813fe9f--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa1fd2f181c5d5dd813fe9f`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Dispatch workflow: owners/admins/dispatchers can assign or unassign an active teammate directly from each job row and during job creation. The selected assignee is also visible in job details. Sales and field users retain assigned-only job visibility and cannot move a job to another teammate.
- Database evidence: the existing active-membership foreign key and assigned-record RLS remain authoritative. All 26 rollback-safe SQL suites passed; the new assignment suite proves dispatcher assignment, assigned-field visibility, field cross-assignment denial, unrelated-sales hiding, and cross-tenant isolation without changing production data.
- Application evidence: formatting, lint, 93 tests across 25 files, the TypeScript/Vite production build, and the runtime dependency audit passed with zero known production vulnerabilities. The deployed browser smoke confirms the correct assignee loads in the job table and details, sample assignment is disabled, and every existing section, console, accessibility, and six-width overflow gate still passes.

## 2026-09-09 role-safe team task-board preview

- Preview: `https://6aa1f760f68873a24adf137d--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa1f760f68873a24adf137d`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Task workflow: every workspace role now has a responsive Open/Completed task board with due dates, overdue counts, assignee identity, optional visible lead/job context, completion/reopen controls, and automatic cross-device refresh. Owners/admins/dispatchers may assign active teammates or create manager-only unassigned work; sales and field users are limited to self-assigned tasks.
- Database evidence: migrations `bontraco_task_workflow` and `bontraco_task_assignee_index` are recorded on Supabase project `eyhrfxyfqqtuwxjcwxbw`; all 25 rollback-safe SQL suites passed. The new suite proves manager visibility/assignment, assigned sales and field visibility/self-creation/completion, cross-assignment denial, and cross-tenant isolation. Advisor review found no disabled RLS, anonymous task access, or unindexed task foreign key; existing intentional GraphQL/function, server-only table, unused-new-index, legacy snapshot, and Auth allocation notices remain.
- Application evidence: formatting, lint, 93 tests across 25 files, the TypeScript/Vite production build, and the runtime dependency audit passed with zero known production vulnerabilities. The deployed browser smoke traversed all eleven workspace sections, exercised the sample task board and drawer, confirmed mutation is disabled in sample mode, and passed the six-width overflow and console-error gates.

## 2026-09-09 atomic duplicate-customer merge preview

- Preview: `https://6aa1f1b2c7c969e6be134c7c--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa1f1b2c7c969e6be134c7c`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Customer workflow: owners/admins can open a suspected duplicate, select the customer record to keep, and type `MERGE` before the destructive control becomes available. The surviving record retains its existing values and inherits only missing profile/assignment values from the removed duplicate.
- Atomic preservation: one tenant-checked transaction locks both records in deterministic order, reparents properties, leads, jobs, appointments, activities, notes, file metadata, calls, communication suppressions, and append-only consent evidence, deletes the duplicate only after every move succeeds, and creates a survivor-linked audit event with bounded moved-record counts. A failed relationship update rolls the entire operation back.
- Database evidence: migration `contact_merge` is recorded on Supabase project `eyhrfxyfqqtuwxjcwxbw`; all 24 rollback-safe SQL suites passed. The new suite proves full relationship and job-location preservation, blank-field inheritance, audit creation, and denial for sales, cross-tenant, and anonymous callers. Advisor review reported only the expected authenticated `SECURITY DEFINER` notice for this explicitly granted, internally owner/admin-checked atomic RPC plus the previously documented advisories; no table, policy, or index finding was introduced.
- Application evidence: formatting, lint, 93 tests across 25 files, the TypeScript/Vite production build, and the runtime dependency audit passed with zero known production vulnerabilities. The deployed six-viewport browser smoke confirms the merge target is labeled, the sample merge remains disabled, and the customer drawer has no console failure or horizontal overflow.

## 2026-09-09 automatic multi-device refresh preview

- Preview: `https://6aa1e78b05ffe02d606ec608--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa1e78b05ffe02d606ec608`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Shared workspace behavior: authenticated membership access, dashboard totals/activity/alerts, Leads, Customers, customer details, Jobs, job details, Schedule, Calls, Reports, Lead Engine, and Team views now reload permitted Supabase data every thirty seconds and whenever the user returns to the browser tab. A remote membership deactivation removes the workspace on the next refresh; transient background membership errors preserve the last view without bypassing database RLS. Hidden tabs do not poll, duplicate focus events are throttled, rejected operational refreshes do not cause unhandled failures, and a slow operational request cannot overlap another refresh.
- Security boundary: refreshes reuse the existing authenticated Supabase client and each view's account filter. Existing row-level security and assigned-record policies remain authoritative; no service credential, public replication, or broader table permission was added.
- Verification: formatting, lint, 93 tests across 25 files, the TypeScript/Vite production build, and the runtime dependency audit passed with zero known production vulnerabilities. The deployed preview passed the complete six-viewport browser smoke across all workspace sections with no console failure or horizontal overflow.

## 2026-09-09 proposal-logo and invoice-document preview

- Preview: `https://6aa1de5c19ae6fc8b429082c--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa1de5c19ae6fc8b429082c`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Branding: owners/admins can upload a JPG, PNG, or WebP logo up to 2 MB. The account path is tenant-constrained, Storage writes and metadata listing are manager-only, anonymous metadata listing returns an empty result, and public reads support customer documents without an account. Browser deletion is denied so issued estimate snapshots retain their original logo; reviewed service operations own eventual retention cleanup.
- Invoice document: every visible job invoice now opens a responsive print/save-PDF document with company identity, customer and service location, scope lines, issue/due dates, subtotal, tax, total, recorded payments, balance due, note, and paid state. Existing invoice RLS still limits document assembly to the user's visible commercial job.
- Database evidence: migrations `proposal_logo_branding` and `protect_proposal_logo_history` are recorded on Supabase project `eyhrfxyfqqtuwxjcwxbw`; all 23 rollback-safe SQL suites passed. The new suite proves tenant path constraints, owner/admin mutation, sales denial, manager-only object metadata, and anonymous listing denial. The estimate-acceptance suite separately proves the frozen snapshot receives the original logo path. Security and performance advisors reported no branding-specific finding.
- Application evidence: formatting, lint, 89 tests across 24 files, the TypeScript/Vite build, zero runtime dependency vulnerabilities, and local/deployed browser smoke passed. The deployed smoke opens the invoice at 360 and 1280 pixels, verifies payment and branding content, confirms no horizontal overflow, and confirms the sample logo upload is visibly disabled.

## 2026-09-09 secure customer estimate acceptance preview

- Preview: `https://6aa1d72c254c048a54145016--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa1d72c254c048a54145016`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Customer flow: authorized office users and assigned sales users can issue a customer link for an open estimate. The proposal snapshot is frozen when issued, the random token remains in the URL fragment, only its SHA-256 hash is stored, and issuing a replacement revokes the prior active unaccepted link. Customers review without an account, explicitly acknowledge the scope, price, and terms, and receive an accepted confirmation that includes the original signer and time.
- Boundary and evidence: three Netlify functions validate exact workspace/session access or a bounded customer token, keep service credentials server-side, never log or return token hashes, and store acceptance evidence in the private schema. Repeated acceptance is idempotent; expired, revoked, declined, void, and otherwise closed estimates fail closed. Workspace export includes acceptance records without token values.
- Database evidence: migrations `estimate_customer_acceptance` and `index_estimate_share_creator` are recorded on Supabase project `eyhrfxyfqqtuwxjcwxbw`. All 22 rollback-safe SQL suites passed after application. The acceptance suite proves frozen snapshots, role and cross-tenant denial, token replacement, view state, explicit acknowledgment, normalized evidence, idempotency, export completeness, and browser-role revocation. Advisors reported no new customer-acceptance security finding and no unindexed acceptance foreign key; the fresh indexes are expected to remain unused until real traffic.
- Application evidence: formatting, lint, 88 tests across 23 files, the TypeScript/Vite build, and a zero-vulnerability runtime dependency audit passed. Local and deployed browser smoke passed across the responsive matrix. `/estimate` is no-store, no-referrer, and noindex; its invalid-link state does not echo the token. Deployed invalid read/accept requests return 404, and unauthenticated link creation returns 401.

## 2026-09-09 estimate branding and defaults preview

- Preview: `https://6aa1a06a44f065cfc4258fe8--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa1a06a44f065cfc4258fe8`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Workspace configuration: owners/admins can set a proposal phone, email, HTTPS website, accent color, default tax rate, validity period, customer note, and terms. Values are tenant-scoped, normalized, length/range checked in Postgres, and included in the owner/admin workspace export.
- Estimate flow: every new draft inherits the current workspace defaults. Saved estimates retain their own note, terms, tax, and validity values; customer previews combine those immutable commercial values with current company contact/branding, job, customer, service-location, and scope data.
- Database evidence: migration `estimate_document_settings` is recorded on Supabase project `eyhrfxyfqqtuwxjcwxbw`; all 21 rollback-safe SQL suites passed together. The profile suite proved defaulting, normalization, owner/admin update access, sales mutation denial, cross-tenant isolation, and database rejection of invalid values. Security/performance advisors reported no new finding.
- Application evidence: formatting, lint, 83 tests across 21 files, the TypeScript/Vite build, and the local and deployed browser smoke passed. The browser gate verifies every sample proposal field is visible but mutation-disabled, the proposal carries company contact data, and both the document and full app remain free of horizontal overflow at the tested mobile and desktop widths.

## 2026-09-09 workspace business-profile preview

- Preview: `https://6aa17479b65984d5562f7d94--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa17479b65984d5562f7d94`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Workspace profile: accounts now store a normalized legal name, IANA timezone, service area, business hours, emergency routing rules, and trade selection. Existing accounts were safely backfilled and future atomic onboarding inherits valid defaults.
- Access verification: owner and admin updates pass; sales users retain read-only same-company context; invalid timezone values are rejected; cross-tenant account rows remain hidden.
- Verification: all 19 rollback-safe live-schema SQL suites, formatting, lint, 74 tests across 20 files, the production build, zero-vulnerability runtime audit, and the expanded six-viewport browser smoke passed. Sample profile fields are present and mutation-disabled.

## 2026-09-09 database-driven plan and seat-limit preview

- Preview: `https://6aa16d610e2e094b3758b798--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa16d610e2e094b3758b798`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`; production was not promoted or changed.
- Application verification: formatting and lint passed, 74 tests across 20 files passed, the TypeScript/Vite production build passed, and the runtime dependency audit reported zero vulnerabilities.
- Database verification: all 18 rollback-safe SQL suites passed together after the plan catalog, seat-limit trigger correction, catalog-permission lock, and subscription-plan foreign-key index migrations were applied to Supabase project `eyhrfxyfqqtuwxjcwxbw`.
- Plan enforcement: Starter, Growth, and AI Pro prices, entitlements, and included-user counts now come from `subscription_plans`. Direct browser membership insertion is denied; pending invitations reserve capacity; invitation writes and member reactivations use a per-workspace transaction lock; accepted invitations consume their reservation; and plan upgrades immediately expose the larger capacity.
- Browser verification: the deployed sample passed all nine workspace sections and the existing six-viewport overflow/console suite. Added checks prove Team displays `4/10` reserved seats and the active plan allowance, while Billing displays the database-equivalent 5/10/10 included-user limits.
- Connected role acceptance: six temporary real Auth identities exercised owner, admin, dispatcher, sales, field, and an independent outsider workspace against the deployed preview. Same-tenant counts matched the role matrix; 40 direct known-ID foreign-record probes were hidden; integration-status returned 200 only for owner/admin and 403 for dispatcher/sales/field. Cleanup confirmed zero remaining test accounts, users, or identities.
- Connected legacy import acceptance: a real owner session imported all 21 preserved leads into a disposable workspace. The immediate retry inserted zero and reported 21 duplicates, the owner read exactly 21 imported leads, and a real sales session received 403. Cascading cleanup left zero test accounts, users, or imported leads.
- Advisor review: the new foreign key is indexed. Signed-in read exposure of the non-sensitive product catalog and authenticated execution of membership-validating RPCs are intentional; the pre-existing server-only ledger notices remain unchanged.
- Outstanding gates remain real five-role connected acceptance, live Stripe/provider acceptance, credential rotation, on-call configuration, isolated backup/restore and purge rehearsals, approved legal documents, product-owner review, and explicit production approval.

## 2026-09-09 billing-enforced lead preview candidate

- Preview: `https://6aa16644d9fe5ee6bb8b95cf--abundant-solutions-crm-20260817.netlify.app/app`
- Netlify deploy ID: `6aa16644d9fe5ee6bb8b95cf`
- Existing published production deploy ID: `6a85fed5609c570dc008fb52`
- Production state after preview deployment: `ready`, still published from 2026-08-19; no production promotion performed.
- Code revision: local commits `b2e0b0b`, `fcc54a8`, and `f1a4efc` on `main`. Repository push remains blocked because the signed-in GitHub account lacks write access to the organization repository.
- Application verification: formatting passed, lint passed, 74 tests across 20 files passed, TypeScript/Vite production build passed, runtime dependency audit reported zero vulnerabilities.
- Database verification: all 17 rollback-safe SQL suites passed together after `lead_engine_entitlement_enforcement` was applied to Supabase project `eyhrfxyfqqtuwxjcwxbw`; the migration appears in the project's migration history.
- Browser verification: deployed demo smoke passed all nine workspace sections, the customer communication-preference flow, and trade-aware lead-search defaults/provider switching at 360, 390, 430, 768, 1280, and 1440 pixels with no horizontal overflow or browser console errors. Local production-mode smoke confirmed `/app` redirects to `/login` and does not expose sample workspace data.
- Role-acceptance harness: the protected runner now creates a separate outsider tenant and verifies that owner, admin, dispatcher, sales, and field sessions cannot retrieve eight known foreign record IDs through direct authenticated Data API requests. Unit expectations and fail-closed leak detection pass; the real connected preview execution remains blocked on the complete preview backend secret and protected GitHub environment.
- Security verification: do-not-contact and append-only consent ledgers remain tenant-scoped with assigned-sales visibility, manager-only suppression lifting, privacy-safe activity events, and service-only provider checks. Lead-profile RLS prevents Starter or inactive accounts from enabling automation while preserving their ability to disable profiles. The collector independently rechecks subscription status, honors the past-due grace window, skips inactive accounts without consuming the four-account execution cap, and counts provider failures after entitlement verification toward that cap. Supabase advisors reported no new issues from the migration; intentional signed-in GraphQL/function visibility and server-only table notices remain documented.
- Recovery tooling: a read-only restore verifier compares Auth users and every critical public table across distinct Supabase projects without reading or printing row contents. The isolated restore and Storage/SQL/workflow drill remain an external launch gate.
- Lead freshness: publicly indexed social/community results require a valid date inside the profile window; stale, malformed, implausibly future, and undated social posts are rejected with aggregate reason metrics. Undated non-post pages retain an explicit provider-filter freshness basis and require human location/request confirmation.
- Lead-source bounds: Tavily profiles require 1–20 normalized permitted domains. The UI rejects paths/wildcards, the collector filters and fails closed when no valid domains remain, and the database prevents empty broad-web profiles.
- Lead relevance and billing: new public-web profiles start with roofing-, plumbing-, or electrical-specific intent phrases based on the workspace trades. Automated scans require Growth or Pro in both database policy and scheduler logic, including the existing seven-day past-due grace rule.
- Outstanding gates: reviewed release commit/CI result, complete preview backend credential, real five-role acceptance, real owner legacy import acceptance, live restricted Google/Tavily/Stripe/optional Retell configuration, on-call endpoint, credential rotation, backup/restore and purge rehearsals, counsel-approved legal documents, product-owner review, and explicit production approval.
