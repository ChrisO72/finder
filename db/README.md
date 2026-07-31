# Database

Drizzle ORM with PostgreSQL and pgvector. See the repository [README](../README.md) for commands.

## Layout

- `schema/` contains domain modules for auth, organizations, settings, videos, transcript segments,
  semantic windows, and tags.
- `schema/shared.ts` owns standard timestamps; `schema/vector.ts` owns the pgvector custom type.
- `repositories/` is the only layer that imports `db.ts`.
- `drizzle/` contains generated SQL and snapshots. Never edit it manually.

## Finder invariants

- Every user-facing domain query is scoped by `organizationId`.
- Videos and tags use soft deletion; reads exclude `deletedAt`.
- Transcript and summary keyword search use PostgreSQL GIN indexes.
- Semantic search depends on 1024-dimension vector columns and HNSW cosine indexes.
- `organizations.webshareProxyUrl` and `organizations.youtubeCookies` configure video downloads.
- Refresh-token hashes are stored in the legacy physical `token` column for a non-destructive
  upgrade; raw tokens are never written by the current application.

## Schema workflow

1. Edit a module under `schema/`.
2. Run `npm run db:generate -- --name=<migration_name>`.
3. Review the generated SQL for destructive vector/index changes.
4. Run `npm run db:migrate`.
5. Commit the schema and generated migration together.

Production PostgreSQL must have the `vector` extension installed before Finder migrations run.
