# Lift-Log — Claude Code Guide

## Stack (locked — do not suggest alternatives)
- **Runtime:** Node.js + TypeScript + tsx
- **Framework:** Express + EJS + HTMX + Tailwind CSS
- **Database:** SQLite + Drizzle ORM (`better-sqlite3`)
- **Auth:** express-session (session cookie, no Passport)
- **Payments:** Stripe (annual-only: Basic $120, Community $300, Coaching $500)
- **Deploy:** DigitalOcean Droplet + PM2 + Nginx

## Git workflow
Always branch from `main`, PR back into `main`. Never commit directly to `main`.

```bash
# Start new work
git checkout main && git pull
git checkout -b feat/short-description   # or fix/, chore/

# When done
git push -u origin <branch>
gh pr create --base main
```

Branch naming:
- `feat/` — new features
- `fix/` — bug fixes
- `chore/` — deps, config, tooling
- `migration/` — database schema changes

## Environment variables (required)
```
NODE_ENV=development
SESSION_SECRET=
DATABASE_URL=./db.sqlite
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_ANNUAL_PRICE_ID=
STRIPE_MONTHLY_PRICE_ID=
```

## Common commands
```bash
npm run dev          # start dev server (port 3000)
npm run check        # TypeScript type check
npm run db:push      # push schema changes to SQLite
npm run db:migrate   # run migrations
npm run db:studio    # open Drizzle Studio
```

## Key files
- `server/index.ts` — app bootstrap, session config
- `server/routes.ts` — all route handlers
- `server/storage.ts` — all DB queries (DatabaseStorage class)
- `server/middleware/subscription.ts` — trial/subscription gate
- `server/stripe.ts` — Stripe client + subscription helpers
- `shared/schema.ts` — Drizzle schema + Zod types
- `views/` — EJS templates

## Database notes
- SQLite file: `db.sqlite` (do not commit to git)
- All workout and goal queries must be scoped by `userId`
- Production migration must be run via SSH on the DigitalOcean droplet

## Deployment
- Server: DigitalOcean Droplet
- Process manager: PM2
- Reverse proxy: Nginx (handles HTTPS — set `NODE_ENV=production` so cookies use `secure: true`)
