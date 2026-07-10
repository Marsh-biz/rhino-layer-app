# Rhino 8 Layer Emulator

A web app that recreates the Rhino 8 **Layers** panel so you can build, refine, and
share layer templates ("standards") outside of Rhino — then round-trip them through
Rhino's native `Layer_Export.json` format.

It runs as a small Node/Express server with an optional PostgreSQL-backed preset
library, so a group can work from one shared set of templates. Without a database it
still runs fully in memory.

## Features

- **Rhino-style layer table** — name tree with color, linetype, and print-width columns.
- **Full editing** — add layers and sublayers, rename, delete, reorder, drag-to-nest,
  and indent / outdent.
- **Named presets** — save the current table as a template, then load, rename, or delete
  presets from a dropdown menu.
- **Shared startup default** — star a preset to have it load automatically on refresh.
- **Auto-save** — an opt-in toggle writes edits back to the loaded preset as you work.
- **Rhino import / export** — read and write Rhino `Layer_Export.json` files, preserving
  the original layer records for a clean round-trip.
- **Light / dark themes.**

## Tech stack

- **Backend:** Node.js + [Express](https://expressjs.com/)
- **Database:** PostgreSQL via [`pg`](https://node-postgres.com/) — optional, with an
  in-memory fallback so the app runs with zero external dependencies
- **Frontend:** a single self-contained `public/index.html` — vanilla HTML, CSS, and
  JavaScript, no framework and no build step
- **Interchange format:** Rhino 8 `Layer_Export.json`

## Getting started

```bash
npm install
npm start          # http://localhost:3000
```

By default the app stores presets in memory (they reset when the server restarts).
To persist them, provide a PostgreSQL connection string:

```bash
DATABASE_URL=postgres://user:pass@host:5432/dbname npm start
```

The required tables are created automatically on startup — no migrations to run.

## Configuration

| Variable        | Required | Description                                                                 |
| --------------- | -------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`  | No       | PostgreSQL connection string. When set, presets and the shared default are persisted; otherwise data is kept in memory. |
| `PORT`          | No       | Port to listen on. Defaults to `3000`.                                      |

## Project structure

- `server.js` — Express app: serves the static site and the preset REST API.
- `public/index.html` — the entire client (UI, state, storage, Rhino import/export).

## API

| Method   | Route                  | Description                                            |
| -------- | ---------------------- | ------------------------------------------------------ |
| `GET`    | `/api/presets`         | List all presets → `{ presets: { "<name>": [tree…] } }` |
| `PUT`    | `/api/presets/:name`   | Create or update a preset — body `{ tree: [...] }`     |
| `DELETE` | `/api/presets/:name`   | Delete a preset                                        |
| `GET`    | `/api/default-preset`  | Get the shared startup default → `{ name }`            |
| `PUT`    | `/api/default-preset`  | Set the startup default — body `{ name }` (or `null` to clear) |
| `GET`    | `/healthz`             | Health check → `{ ok, db }`                            |

## Data storage

When `DATABASE_URL` is set, two tables are created automatically:

- `presets(name TEXT PRIMARY KEY, tree JSONB, updated_at TIMESTAMPTZ)`
- `settings(key TEXT PRIMARY KEY, value TEXT)` — holds app-wide settings such as the
  shared default preset.

Layer trees are stored as JSON, so new fields added to a layer don't require schema changes.

## Notes

There is **no authentication** — anyone who can reach the server can view and edit
presets. Add an access-control layer before exposing it beyond a trusted environment.
