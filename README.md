# Bontraco

Bontraco is a multi-tenant contractor operations SaaS for roofing, plumbing, and electrical companies. It combines customer and service-location records, leads, jobs, scheduling, estimates, invoices, team permissions, an optional lead engine, and an optional AI receptionist.

The active application is in [`bontraco/`](./bontraco). Root commands forward to that application:

```bash
npm install --prefix bontraco
npm run verify
npm run dev
```

## Deployment

The repository-root `netlify.toml` sets `bontraco` as the Netlify base directory. Git-based and command-line builds therefore publish the same application and serverless functions. Production promotion remains a manual, checklist-gated operation.

See [`docs/BONTRACO_RELEASE_CHECKLIST.md`](./docs/BONTRACO_RELEASE_CHECKLIST.md) before changing production.

Netlify production builds run `npm run preflight:production` before compiling. The preflight reports configuration names and readiness only; it never prints secret values. Preview builds remain separate and demo-enabled.

## Security

Provider credentials belong in scoped Netlify environment variables and must never be committed. Supabase Row Level Security is the tenant boundary. Run the unit/build gate and all database isolation suites before release.

Private software. All rights reserved.
