# finder

A full-stack Node + React application

## Comes with:

- React Router 7 SSR web app
- Drizzle ORM + PostgreSQL
- BullMQ job queues + scheduler (Redis)
- JWT auth with refresh tokens
- Multi-org user system
- Catalyst UI Kit

## Setup

```bash
# Environment variables

# Auth
JWT_SECRET=your-secret-key
REFRESH_SECRET=your-refresh-secret

# Database
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# Redis
REDIS_URL=redis://default:password@host:port

# API Keys
HIKER_API_KEY=your-hiker-api-key
GOOGLE_API_KEY=your-google-api-key
```

### Database

```bash
npx drizzle-kit generate --name=migration_name   # generate migration
npx drizzle-kit migrate                          # apply migrations
npx drizzle-kit studio                           # open database browser
```

Spin up a local Postgres instance for testing:

```bash
docker compose up -d
```

This starts Postgres 16 on `127.0.0.1:55432` with the defaults:

| Setting  | Default           |
| -------- | ----------------- |
| Database | `finder`          |
| User     | `finder-user`     |
| Password | `finder-password` |

Override credentials via environment variables `POSTGRES_USER` and `POSTGRES_PASSWORD` if needed.

To stop and remove the container:

```bash
docker compose down
```

To also wipe the persisted data:

```bash
docker compose down -v
```
