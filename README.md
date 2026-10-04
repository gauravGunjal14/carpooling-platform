# Carpooling Platform

A TypeScript MERN monorepo for a trust-aware, safety-focused carpooling platform. The current release establishes the project foundation and a public landing page. Authentication, data models, and product APIs are planned for later phases.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Run locally

```bash
npm install
npm run dev
```

The Vite client runs at `http://localhost:5173`. The Express server starts independently at `http://localhost:4000` and has no product business logic yet.

Useful commands: `npm run client`, `npm run server`, `npm run build`, and `npm run typecheck`.

## Project structure

- `client/` — React, Vite, TypeScript, Tailwind CSS public web application
- `server/` — TypeScript and Express service foundation
- `docs/` — architecture, feature plan, and phased delivery plan

See [docs/architecture.md](docs/architecture.md), [docs/features.md](docs/features.md), and [docs/development-phases.md](docs/development-phases.md).
