# Fullstack Blueprint

A template for building full-stack Node + React applications

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

### Development

```bash
npm install
npx react-router typegen      # generate route types (run after adding/renaming routes)
make dev
```

### Production (Docker)

```bash
make build   # build image
make run     # run container
make stop    # stop container
```

Runs web server + worker in a single container on port 3000.

### Render Deployment

Set runtime to **Docker** — it picks up the `Dockerfile` automatically.
