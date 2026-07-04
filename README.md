# Rhino 8 Layer Emulator — Railway deployment

A small Express server that serves the layer emulator and a Postgres-backed
preset API so the whole team shares one preset library.

## Structure
- `server.js` — Express app: static site + `/api/presets` REST API
- `public/index.html` — the emulator (API-first storage, falls back gracefully)
- Postgres table `presets(name TEXT PK, tree JSONB, updated_at)` is created
  automatically on first boot.

## API
- `GET    /api/presets`        → `{ presets: { "<name>": [tree…] } }`
- `PUT    /api/presets/:name`  → body `{ tree: [...] }` (upsert)
- `DELETE /api/presets/:name`
- `GET    /healthz`            → `{ ok, db }`

## Note on access
There is no authentication — anyone with the URL can read and edit presets.
Fine for an internal team link; if the URL will circulate wider, add an access
key check before shipping it around.
