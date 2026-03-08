# finder

Turn any video into something you can search. Paste a YouTube link and jump straight to the moment you’re looking for.

## Tech stack

- React Router 7 (SSR) + Tailwind + Catalyst UI
- Drizzle ORM + PostgreSQL
- BullMQ job queues + Redis
- Mistral Voxtral (audio transcription) + Mistral Embed (embeddings)
- JWT auth with multi-org support

## Prerequisites

- Node.js 20+
- **yt-dlp** -- `brew install yt-dlp`
- **ffmpeg** -- `brew install ffmpeg`
- Docker (for local Postgres + Redis)

## Getting started

```bash
npm install
cp .env.example .env   # fill in your keys
docker compose up -d    # local Postgres + Redis
npx drizzle-kit migrate # apply migrations
npm run dev
```

### Environment variables

```bash
JWT_SECRET=your-secret-key
REFRESH_SECRET=your-refresh-secret
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
REDIS_URL=redis://localhost:6379
MISTRAL_API_KEY=your-mistral-api-key
```

### Database

```bash
npx drizzle-kit generate --name=migration_name   # generate migration
npx drizzle-kit migrate                          # apply migrations
npx drizzle-kit studio                           # open database browser
```

Local Postgres runs on `127.0.0.1:55432` and Redis on `127.0.0.1:6379` via Docker Compose.

| Service  | Setting  | Default                  |
| -------- | -------- | ------------------------ |
| Postgres | Database | `finder`                 |
| Postgres | User     | `finder-user`            |
| Postgres | Password | `finder-password`        |
| Redis    | URL      | `redis://localhost:6379` |

```bash
docker compose down      # stop
docker compose down -v   # stop and wipe data
```
