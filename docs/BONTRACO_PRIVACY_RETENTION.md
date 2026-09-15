# Bontraco Privacy and Retention Baseline

This is an implementation baseline for counsel and customer-contract review, not legal advice or a published privacy policy.

## Data categories

| Category | Examples | Default retention target |
| --- | --- | --- |
| Account and membership | company, users, roles, invitations | account life plus 30 days |
| Public company branding | current and historically referenced proposal logos | account life plus commercial-document retention; remove unreferenced prior versions on a reviewed schedule |
| CRM operations | contacts, properties, leads, jobs, field checklists, notes, tasks | account life plus 30 days |
| Commercial records | estimates, frozen customer proposal snapshots, acceptance evidence, invoices, payments | customer-configured legal/accounting period |
| Public lead evidence | source URL, excerpt, discovery time, qualification | 90 days unless converted or required longer |
| Google Places content | business display data and verification time | refresh or remove within 30 days; Place ID may be retained as permitted |
| Call metadata/transcripts | number, summary, transcript, disposition | 90 days by default |
| Call recordings | recording reference | 30 days by default, configurable downward |
| Security/audit events | activity, webhook replay, export/deletion events | 12 months |
| Import audit | batch status, counts, warnings, rollback manifest | account life plus 30 days |
| Backups | encrypted managed backups | provider recovery window, then expiry |
| Legacy prototype snapshot | one workspace shell, 21 scraped lead records, and one scan record | until verified owner import or written disposal approval |

## Rules

- Every customer-owned row is scoped to an account and protected by row-level security.
- Sales and field users receive assigned-record access rather than company-wide access.
- Provider credentials remain server-side and are never returned by the integration-health endpoint.
- Company logos are public assets by design. The upload control accepts only supported image formats and must never contain customer, credential, or internal-only information; browser users cannot delete historical logo objects referenced by commercial documents.
- Customer estimate links use random secret tokens in the URL fragment; only a one-way token hash is stored. Acceptance evidence is private, exported only for the verified workspace, and includes the frozen proposal, explicit statement, signer identity, time, device description, and an irreversible network-evidence hash when available.
- Public contact information is not proof of consent for automated calls, texts, or email.
- Outbound automated calling stays disabled until consent and regulatory review are implemented.
- Recording must be disabled unless the workspace configures disclosure and applicable consent.
- Google Maps attribution must remain visible with Places-derived content, and provider data must be refreshed or removed under current terms.

## Data-subject and customer requests

1. Verify the requester and the owner/admin relationship to the workspace.
2. Record request type, scope, account, requester, received time, and deadline.
3. Export only the verified account; scan for secrets and unrelated tenant identifiers before delivery.
4. For correction, update the source CRM record and preserve an audit entry.
5. For deletion, wait through the recoverable 14-day grace period, verify a readable export, clear legal/financial holds, and require a separate operations approval.
6. Purge tenant database rows, registered private files, Stripe customer/subscription data, and Retell call artifacts; never delete a shared voice agent/number or a user who still belongs to another workspace.
7. Record only minimal request, approval, completion, and incident evidence without retaining the deleted customer content itself. Managed backup copies expire through the documented recovery window.

## Subprocessors to validate before publication

- Netlify: hosting, functions, and deployment logs.
- Supabase: authentication, database, storage, and backups.
- Stripe: subscription checkout and billing.
- Retell: voice calls, transcripts, recordings, and usage.
- Tavily: public web-search requests.
- Google Maps Platform: Places searches and returned business data.

The published subprocessor list must include purpose, processing location when available, and a change-notice process.

## Counsel review pack

- `docs/legal/BONTRACO_ACCEPTABLE_USE_DRAFT.md` turns the lead-source and outreach restrictions into a customer-facing acceptable-use draft.
- `docs/legal/BONTRACO_AI_CALLING_CONSENT_DRAFT.md` defines fail-closed AI calling, consent, recording, suppression, and launch-evidence requirements.

Both drafts remain unpublished until counsel approves the exact operating jurisdictions, business identity/contact details, customer agreement, privacy notice, and provider configuration.
