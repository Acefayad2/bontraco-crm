# Bontraco Product Scope

## Product definition

Bontraco is a multi-tenant SaaS operating system for small and midsize home-service contractors. It combines lead intake, customer and job management, estimating, field documentation, team permissions, automation, and an optional 24/7 AI receptionist.

The initial market is United States roofing and exterior-restoration contractors. Plumbing and electrical workflows follow as configurable vertical templates after the roofing workflow passes production acceptance tests.

## Core promise

Bontraco helps a contractor capture every opportunity, respond immediately, book the right appointment, and move the resulting job from first contact to final payment without losing context.

## Primary personas

### Company owner

- Creates and configures a company workspace.
- Chooses trade templates, plan, locations, business hours, and call handling.
- Manages employees, permissions, pipelines, integrations, billing, and reporting.
- Sees all company records and audit history.

### Office administrator / dispatcher

- Manages customers, schedules, jobs, calls, messages, assignments, and documents.
- Can see all operational records but cannot change subscription ownership or security settings.

### Sales representative

- Sees assigned leads, customers, appointments, estimates, and jobs.
- Creates notes, tasks, estimates, photos, and status updates within assigned work.
- Cannot see another representative's records unless granted team-wide access.

### Project manager / technician

- Sees assigned jobs, appointment details, property information, checklists, photos, documents, and notes.
- Updates field status and uploads evidence.
- Cannot access billing, company administration, or unrelated customer records.

### Bontraco platform administrator

- Manages plans, feature flags, account support, abuse response, and platform health.
- Uses explicit support access with an audit trail; cannot silently impersonate a customer.

## Product modules

### 1. Account and workspace administration

- Email/password authentication, password recovery, email verification, and optional Google sign-in.
- Company workspace onboarding with legal name, trade name, logo, timezone, service area, business hours, trades, and emergency rules.
- Multiple locations and phone numbers on eligible plans.
- Invitations, role templates, custom permissions, suspension, and session revocation.
- Strict tenant isolation at the database layer.

### 2. Lead inbox

- Manual entry, web forms, call-created leads, imports, and permitted public-source discovery.
- Source, service, urgency, freshness, location, score, contact information, consent provenance, and duplicate detection.
- Owner assignment rules and representative-specific visibility.
- Statuses: new, reviewing, qualified, contacted, appointment, converted, lost, rejected.
- One-click conversion to customer, property, appointment, and job.

### 3. CRM and job operations

- Customers, multiple service properties, contacts, jobs, appointments, tasks, notes, tags, and activity timeline.
- Trade-specific pipelines with configurable stages and required-stage checklists.
- Estimates, proposals, contracts, signatures, invoices, payments, and margin tracking.
- Photo and document storage using private buckets and signed URLs.
- Search, filtering, saved views, CSV import/export, and duplicate merge.

### 4. Vertical templates

#### Roofing and restoration

- Retail and insurance workflows.
- Roof, siding, gutter, window, flat-roof, and other trades.
- Inspection, claim, adjustment, supplement, production, depreciation, and payment stages.
- Roof measurements, damage documentation, carrier notes, contracts, and pricing templates.

#### Plumbing

- Emergency versus standard intake.
- Leak, drain, sewer, fixture, water heater, supply, and repipe workflows.
- Dispatch priority, equipment, parts, property access, and completion checklist.

#### Electrical

- Safety-first intake with emergency escalation.
- Outage, sparking, burning odor, panel, circuit, lighting, EV charger, and service-upgrade workflows.
- No autonomous diagnostic or repair advice for hazardous conditions.

### 5. AI receptionist add-on

- Dedicated or forwarded business number.
- Disclosure that the caller is speaking with an automated assistant.
- Configurable greeting, business hours, languages, knowledge base, services, service area, qualification questions, and forbidden claims.
- New-customer intake, existing-customer lookup, appointment booking, message taking, call transfer, emergency escalation, spam handling, and opt-out handling.
- Recording and transcription settings that respect configured consent requirements.
- Call summary, structured disposition, contact, lead, appointment, tasks, and timeline event written to the correct workspace.
- Human fallback when confidence is low, the caller requests a person, or a safety rule triggers.
- Per-minute usage metering, included allowances, overage limits, and automatic service protection.
- Inbound-first launch. Automated outbound calling is disabled unless a compliant consent workflow is explicitly implemented and reviewed.

### 6. Automation and communication

- Templates for appointment confirmations, reminders, missed-call texts, estimate follow-up, review requests, and internal alerts.
- Quiet hours, consent state, unsubscribe processing, delivery status, retry policy, and per-account rate limits.
- Durable channel-specific do-not-contact records override consent and must be checked server-side before every outbound provider request; lifting requires an authorized manager, reason, timestamp, and audit event.
- Idempotent event processing so retries never send duplicate customer messages.

### 7. Billing and plans

- Stripe Checkout and Customer Portal.
- Trial, monthly, and annual plans.
- Base subscription, user limits, location limits, receptionist minute allowance, lead-search allowance, and usage overages.
- Webhook-driven subscription state; client-side payment state is never authoritative.
- Grace period, failed-payment handling, downgrade behavior, cancellation, invoices, tax settings, and refunds policy.

### 8. Reporting

- Lead source, response time, contact rate, booking rate, close rate, job value, pipeline value, revenue, margin, call outcomes, missed-call recovery, and receptionist usage.
- Role-aware dashboards and exportable date ranges.
- No invented revenue attribution: each report must identify its source records and calculation window.

## Initial plans

Plan limits are configuration, not hard-coded UI decisions.

| Plan | Monthly target | Included users | Primary capabilities |
| --- | ---: | ---: | --- |
| Starter | $299 | 5 | CRM, pipeline, estimates, contracts, basic reporting |
| Growth | $499 | 10 | Starter plus lead inbox, automations, advanced reporting |
| AI Pro | $899 | 10 | Growth plus AI receptionist and included calling allowance |
| Multi-location | Custom | Custom | Multiple locations, higher limits, onboarding and support SLA |

## Compliance and trust requirements

- Collect only permitted data and retain source/provenance for discovered leads.
- Provide privacy notice, terms, acceptable-use policy, subprocessor list, data processing terms, and deletion/export workflow.
- Never market discovered public contact data as verified consent for automated outreach.
- Encrypt data in transit and at rest through managed providers.
- Keep provider keys server-side and rotate any key that was exposed outside an approved secret store.
- Maintain tenant-scoped audit events for sensitive reads, writes, exports, permission changes, and support access.
- Define retention for call recordings, transcripts, rejected leads, deleted workspaces, and backups.

## Launch acceptance criteria

Bontraco is production-ready only when all of the following pass:

1. An unauthenticated request cannot read or mutate any workspace data.
2. A user in workspace A cannot discover, read, reference, or mutate workspace B data, including by guessed identifiers.
   User-triggered server functions must require the currently selected workspace ID and verify the caller's active membership and role in that exact workspace; they must never select an arbitrary first membership.
3. Owner, admin, sales, and field roles pass an automated permission matrix.
4. Sign-up, verification, onboarding, invitation, password recovery, suspension, and logout work on the deployed site.
5. A new workspace can create a lead, convert it, schedule it, estimate it, document it, and close it on desktop and mobile.
6. AI receptionist test calls create correct records, transfer safely, book only available slots, and never cross tenants.
7. Billing webhooks are signature-verified, idempotent, replay-tested, and control plan entitlements.
8. Lead discovery obeys freshness, geography, provenance, deduplication, rate, and account limits.
9. Files are private, size/type limited, malware-aware where applicable, and accessible only by authorized signed URLs.
10. Backups, recovery, monitoring, alerting, audit logs, deletion, and export are tested.
11. Critical paths have automated tests and a documented rollback procedure.
12. No development bypass, demo credentials, secret, or direct browser-to-provider AI call exists in production.

## Explicit non-goals for the first production release

- Payroll, full accounting, inventory ERP, fleet management, or replacing QuickBooks.
- Autonomous emergency diagnosis or repair instructions.
- Unconsented AI cold calling, spam messaging, or bypassing platform access controls.
- A native iOS or Android application before the responsive web application is proven.
- Supporting every contractor vertical before roofing, plumbing, and electrical templates are stable.
