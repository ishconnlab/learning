# IshConnect LMS

Offline-first, book-based learning platform for Rwanda TVET (L3/L4/L5) and general
secondary education. Courses are structured from the official textbook library, with
practical activities, MCQ assessments, assignments, a three-task final project, and
verifiable certificates.

Monorepo:

| Workspace  | Stack                                          | Dev URL               |
| ---------- | ---------------------------------------------- | --------------------- |
| `backend`  | Node 20 · Express 4 · MongoDB (Mongoose 8)     | http://localhost:4000 |
| `frontend` | React 18 · Vite 5 · Tailwind · PWA (Workbox)   | http://localhost:5173 |

## Quick start

```bash
npm install
cp backend/.env.example backend/.env   # then fill in real values
npm run dev                            # api (4000) + web (5173)
```

Requirements: Node >= 20, a MongoDB deployment (Atlas or local `mongod`).

### Useful scripts

```bash
npm run dev              # backend + frontend together
npm run build            # build backend, then frontend
npm run build:backend
npm run build:frontend
npm run test             # backend tests (vitest)
npm run test:frontend    # frontend tests (vitest)
npm run lint
npm run seed             # seed CMS pages / demo data
npm run ingest           # ingest the book library into draft courses
npm run create-admin     # create the first platform administrator
```

## Environment

All backend secrets live in `backend/.env` (gitignored). See `backend/.env.example`
for the full list. Key variables:

- `MONGODB_URI` — MongoDB Atlas or local connection string.
  - Some sandboxes block DNS **SRV** lookups (`querySrv ECONNREFUSED`). If so, use a
    direct seed-list URI: `mongodb://user:pass@shard-00-00...,.../db?ssl=true&authSource=admin`.
- `JWT_SECRET` — long random string. Generate:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `CLIENT_ORIGIN` — the frontend origin allowed by CORS.
- `STORAGE_DRIVER` — `local` (dev) or `s3` (production, durable object storage).
- `COOKIE_SECURE=true` in production (requires HTTPS).

## Deployment

- **Frontend → Vercel.** Set the project root to `frontend/`. `frontend/vercel.json`
  configures the SPA rewrite, PWA caching headers, and security headers. Set
  `VITE_API_URL` to the backend's public `…/api/v1` URL.
- **Backend → Render.** `render.yaml` provisions a web service (`npm ci` + build backend,
  `node dist/index.js`) with a `/health` check. Set the secret env vars in the Render
  dashboard (`MONGODB_URI`, `JWT_SECRET`, origin, storage keys).

> Local disk on Render/Vercel is ephemeral. For production, set `STORAGE_DRIVER=s3`
> (S3 / Cloudflare R2 / MinIO) so uploaded books and certificate PDFs persist.

## Design tokens

Brand palette is centralised in `frontend/tailwind.config.js`:

- Purple `brand` — primary, anchored on `#695BBE`
- Green `accent` — anchored on `#01C82F`
- `plum` `#A1666E`, `surface.tint` `#E7F1EC`

## Status

- Frontend production build: passing (`npm run build:frontend`)
- Backend TypeScript check: passing (`npx tsc -p tsconfig.json --noEmit`)
- Database: MongoDB Atlas connectivity verified (`ping ok`)

See the project owner for the full audit, offline-sync validation, and acceptance-test
matrix before claiming production readiness.
