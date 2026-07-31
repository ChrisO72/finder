# Web

React Router 8 SSR application. See the repository [README](../README.md) for setup and commands.

## Routes and authentication

Routes are declared in [routes.ts](routes.ts). The landing page and auth routes sit outside the
protected [layout route](routes/layout.tsx); its middleware authenticates once, stores the user in
`authenticatedUserContext`, and appends rotated cookies to the response. The nested admin layout
enforces the administrator role for the entire application.

Finder keeps all domain reads and writes scoped to `user.organizationId`:

- `/` is the public landing page.
- `/admin` searches transcript segments, semantic windows, summaries, and tags.
- `/admin/episodes` saves and manually syncs Buzzsprout feeds and lists imported episodes.
- `/admin/episodes/:id` owns audio playback, transcript navigation, retry, and soft deletion.
- `/admin/users` and `/admin/settings` control user accounts and signup policy.

## Server boundaries and data access

- Server-only modules end in `.server.ts`.
- Routes access PostgreSQL only through `~/db/repositories/*`.
- Queue producers use `enqueueJob`; they never add directly to a BullMQ queue.
- Buzzsprout RSS parsing and validation lives in [lib/buzzsprout.server.ts](lib/buzzsprout.server.ts).
- Mistral query embeddings live in [lib/search.server.ts](lib/search.server.ts), outside database
  repositories.

## Forms and UI

Parse action input with Zod and `parseForm` from [lib/form.ts](lib/form.ts). Return the shared
`ActionData` shape and render `FormError` and `FieldError` consistently.

Use the Catalyst primitives in [components/ui-kit](components/ui-kit) before creating new controls.
Tailwind tokens live in [app.css](app.css).
