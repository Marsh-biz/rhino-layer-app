# Rhino 8 Layer Emulator — Railway deployment

A small Express server that serves the layer emulator and a Postgres-backed
preset API so the whole team shares one preset library.

## Structure
- `server.js` — Express app: static site + `/api/presets` REST API
- `public/index.html` — the emulator (API-first storage, falls back gracefully)
- Postgres table `presets(name TEXT PK, tree JSONB, updated_at)` is created
  automatically on first boot.

## Deploy on Railway

1. **Add Postgres to the project**
   In your Railway project: `+ New` → `Database` → `Add PostgreSQL`.

2. **Give the service the connection string**
   Open your (empty) service → `Variables` → `New Variable` → `Add Reference`
   → pick the Postgres service's `DATABASE_URL`. This creates
   `DATABASE_URL = ${{Postgres.DATABASE_URL}}` on your service.

3. **Deploy this folder** (either way works)
   - **CLI:** `npm i -g @railway/cli`, then from this folder:
     `railway login` → `railway link` (pick your project + service) → `railway up`
   - **GitHub:** push this folder to a repo, then in the service:
     `Settings` → `Source` → `Connect Repo`. Railway autodetects Node and runs
     `npm install` + `npm start`.

4. **Expose it**
   Service → `Settings` → `Networking` → `Generate Domain`.
   You'll get `https://<something>.up.railway.app`.

5. **Embed in Notion**
   In Notion type `/embed` and paste the Railway URL.

## Local development
```
npm install
npm start          # http://localhost:3000 (in-memory presets, no DB needed)
DATABASE_URL=postgres://... npm start   # against a real database
```

## API
- `GET    /api/presets`        → `{ presets: { "<name>": [tree…] } }`
- `PUT    /api/presets/:name`  → body `{ tree: [...] }` (upsert)
- `DELETE /api/presets/:name`
- `GET    /healthz`            → `{ ok, db }`

## Note on access
There is no authentication — anyone with the URL can read and edit presets.
Fine for an internal team link; if the URL will circulate wider, add an access
key check before shipping it around.
