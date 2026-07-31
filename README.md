# Finder

Turn public Buzzsprout podcasts into a searchable audio archive. Save a feed, process its episodes,
and jump straight to the moment you are looking for.

## Tech stack

- React Router 8 (SSR) + Tailwind + Catalyst UI
- Drizzle ORM + PostgreSQL with pgvector
- BullMQ job queues + Redis
- Mistral Voxtral (audio transcription) + Mistral Embed (embeddings)
- JWT auth with multi-org support and Lettermint email delivery

## Prerequisites

- Node.js 24+
- Docker (for local PostgreSQL + Redis)

## Local development

### First-time setup

```bash
npm install
cp .env.example .env          # configure secrets and API keys
npm run docker:up             # start PostgreSQL + Redis
npm run db:migrate            # apply database migrations
```

PostgreSQL is exposed on `127.0.0.1:55432` and Redis on `127.0.0.1:6379`. The PostgreSQL container uses the `pgvector/pgvector:pg16` image; its defaults are database `finder`, user `finder-user`, and password `finder-password`.

### Start the development servers

```bash
npm run dev
```

The web app runs at `http://localhost:5173`; the worker runs alongside it.

### Environment variables

All variables are validated at boot by [env.server.ts](env.server.ts). Copy [.env.example](.env.example) and configure:

- `DATABASE_URL` and `REDIS_URL`
- `JWT_SECRET` and `REFRESH_SECRET` (at least 32 characters each)
- `LETTERMINT_API_KEY`, `MAIL_FROM`, and `APP_URL`
- `MISTRAL_API_KEY`

### Buzzsprout workflow

Sign in as an administrator, open `/admin/episodes`, and add the public HTTPS RSS feed from a
Buzzsprout podcast. Finder saves the feed, imports new episodes, and queues their public audio
enclosures for transcription. Use the feed's **Sync** action whenever you want to discover newly
published episodes.

### Database, queue, and containers

```bash
npm run docker:up                              # start containers
npm run docker:down                            # stop containers
npm run docker:wipe                            # stop and delete volumes

npm run db:generate -- --name=migration_name   # create a migration
npm run db:migrate                             # apply migrations
npm run db:studio                              # open Drizzle Studio
```

## Production

```bash
npm run build                  # build web + worker
npm run start:web              # web server only
npm run start:worker           # background worker only
npm run start                  # run both for a single-box deployment or smoke test
```

For production deployments, run `start:web` and `start:worker` as separate supervised processes so each has independent logs, restarts, and scaling. `npm start` uses `concurrently --kill-others-on-fail`, so either process exiting stops both.

## Checks

```bash
npm run check                  # typecheck + lint + format
```

`npm run check` runs `react-router typegen && tsc && eslint . && prettier --check .` and is the required pre-finish gate.

## Fresh schema note

The Buzzsprout version uses a clean migration baseline and does not migrate rows from the previous
media schema. If your local Docker volume contains that schema, run `npm run docker:wipe`, start
the containers again, and apply the migration.

## Project layout

- `web/` — React Router SSR app
- `worker/` — BullMQ jobs and scheduled work
- `db/` — schema, generated migrations, and repository functions

## Conventions

- **Path aliases:** `~/*` → `web/*`, `~/db/*` → `db/*`, `~/worker/*` → `worker/*`, and `~/env.server` → `env.server.ts`. Use aliases for cross-package or multi-level imports; sibling imports may remain relative. ESLint rejects imports beginning with `../../`.
- **Server-only modules** end in `.server.ts` and must not be imported by client components.
- **Generated directories:** `.react-router/`, `build/`, and `db/drizzle/`. Generate migrations with `npm run db:generate`; do not edit them manually.
- **Secrets:** `.env` is ignored. Document variables in `.env.example` and validate them in `env.server.ts`.
- **TypeScript strict mode** is enabled across the repository.
- **Database access** goes through `db/repositories/`, with one repository per table.
