# Web

React Router 8 SSR application. See the repository [README](../README.md) for setup and commands.

## Routes and authentication

Routes are declared in [routes.ts](routes.ts). Public auth routes sit outside the protected
[layout route](routes/layout.tsx); its middleware authenticates once, stores the user in
`authenticatedUserContext`, and appends rotated cookies to the response. Protected loaders and
actions read that user with `getAuthenticatedUser(context)`.

Finder keeps all domain reads and writes scoped to `user.organizationId`:

- `/` searches transcript segments, semantic windows, summaries, and tags.
- `/videos` creates and lists videos and enqueues the typed `process-video` job.
- `/videos/:id` owns playback, transcript navigation, retry, and soft deletion.
- `/settings` stores organization-specific proxy and YouTube cookie configuration.
- `/admin` controls signup policy and user administration.

## Server boundaries and data access

- Server-only modules end in `.server.ts`.
- Routes access PostgreSQL only through `~/db/repositories/*`.
- Queue producers use `enqueueJob`; they never add directly to a BullMQ queue.
- Mistral query embeddings live in [lib/search.server.ts](lib/search.server.ts), outside database
  repositories.

## Forms and UI

Parse action input with Zod and `parseForm` from [lib/form.ts](lib/form.ts). Return the shared
`ActionData` shape and render `FormError` and `FieldError` consistently.

Use the Catalyst primitives in [components/ui-kit](components/ui-kit) before creating new controls.
Tailwind tokens live in [app.css](app.css).
