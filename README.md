# Carpooling Platform

A TypeScript MERN monorepo for a trust-aware, safety-focused carpooling platform. The current release includes the public landing page and Phase 2 account authentication and profile foundation.

## Requirements

- Node.js 20.19 or newer (or Node.js 22.12 or newer)
- npm 10 or newer

## Run locally

```bash
npm install
npm run dev
```

Before starting the server for the first time, copy `.env.example` to `.env`, set strong, separate JWT secrets, and point `MONGODB_URI` to a MongoDB instance. For local MongoDB, the example URI uses `127.0.0.1:27017`. The client is available at `http://localhost:5173`; Vite proxies `/api` calls to the API at `http://localhost:4000`.

Create an administrator account by setting `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env`, then run:

```bash
npm run create-admin
```

Admin accounts cannot be created through public registration. Remove the three `ADMIN_*` values after provisioning.

Useful commands: `npm run client`, `npm run server`, `npm run build`, and `npm run typecheck`.

## Project structure

- `client/` — React, Vite, TypeScript, Tailwind CSS public web application
- `server/` — TypeScript, Express, MongoDB/Mongoose service
- `docs/` — architecture, feature plan, and phased delivery plan

See [docs/architecture.md](docs/architecture.md), [docs/features.md](docs/features.md), and [docs/development-phases.md](docs/development-phases.md).
