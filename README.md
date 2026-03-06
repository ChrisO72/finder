# finder

Turn videos into searchable archives. Drop a YouTube link, and Finder transcribes it, indexes the content, and lets you search across everything. Looking for more info on Psalm 22? Finder points you to timestamp 10:11 in that one Bible study from last March.

No more scrubbing through hour-long videos hoping you remembered the right one.

## Tech stack

- React Router 7 (SSR) + Tailwind + Catalyst UI
- Drizzle ORM + PostgreSQL
- BullMQ job queues + Redis
- JWT auth with multi-org support

## Getting started

```bash
npm install
cp .env.example .env   # fill in your keys
docker compose up -d    # local Postgres
npm run dev
```

### Environment variables

```bash
JWT_SECRET=your-secret-key
REFRESH_SECRET=your-refresh-secret
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
REDIS_URL=redis://default:password@host:port
HIKER_API_KEY=your-hiker-api-key
GOOGLE_API_KEY=your-google-api-key
```

### Database

```bash
npx drizzle-kit generate --name=migration_name   # generate migration
npx drizzle-kit migrate                          # apply migrations
npx drizzle-kit studio                           # open database browser
```

Local Postgres runs on `127.0.0.1:55432` via Docker Compose with these defaults:

| Setting  | Default           |
| -------- | ----------------- |
| Database | `finder`          |
| User     | `finder-user`     |
| Password | `finder-password` |

```bash
docker compose down      # stop
docker compose down -v   # stop and wipe data
```
