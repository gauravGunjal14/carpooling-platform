# Architecture

## Current foundation

The repository uses an npm workspaces monorepo so the React client and Express service can be developed, typechecked, and built independently. The landing page still uses static demonstration data. Phase 2 adds MongoDB-backed accounts and a JSON API for authentication and a basic profile.

## Client and server separation

`client/` contains the Vite, React, TypeScript, Tailwind CSS, and React Router application. Page composition, reusable components, sections, static data, and types live in separate folders. `server/` contains the Node.js and Express TypeScript API, configuration, middleware, Mongoose models, controllers, routes, and services.

## Authentication and roles

Public registration accepts Passenger and Driver only. Admin accounts are provisioned with the `npm run create-admin` command and environment variables. Passwords are bcrypt-hashed and never returned. Access JWTs are short-lived and held in client memory; refresh JWTs are rotated and stored only as SHA-256 hashes on the user record, and delivered in an HTTP-only, SameSite Strict cookie. This initial implementation permits one active refresh session per account; signing in again replaces it. Roles are read from the current database account by authentication middleware, and the `authorize` middleware provides server-side role gates for later role-specific APIs. Client route guards are a navigation aid, not the security boundary.

`GET /api/auth/me` returns the signed-in user’s safe profile. `PATCH /api/auth/me` currently permits the account holder to update only their display name. Email and role changes are intentionally outside this phase.

## Future API layer

Add versioned Express routes, request validation, controllers, and services in later phases. Keep transport concerns in controllers and domain rules in services. The client API module consumes JSON request/response contracts; the UI does not depend directly on persistence models.

## Future data layer

MongoDB and Mongoose models will be added when authentication and ride-management phases begin. Keep persistence behind service boundaries and enforce access control and privacy on the server.

## Future Socket.io layer

Introduce Socket.io after booking flows exist. Authenticate socket connections, authorize room membership on the server, and publish only events visible to their recipients. Real-time messages complement, rather than replace, persisted API state.

## Future matching engine

Build matching as a server-side service using normalized coordinates, Haversine distance, route and departure compatibility, seat availability, and permitted user preferences. The 30 km radius and ranking policy belong in validated server configuration, not UI components. The current match card is illustrative only.

## Future trust engine

Keep trust inputs transparent, behavior-based, and separate from identity attributes. Do not use protected or sensitive attributes as score inputs. The server will calculate and expose only the authorized trust summary needed by each interface.

## Future verification system

Verification state must be authoritative on the server, with least-privilege access to sensitive evidence, secure review workflows, retention limits, and audit trails. Avoid collecting or exposing Aadhaar data unless a defined lawful requirement makes it necessary. Frontend eligibility checks are presentation only; the server must enforce women-only ride rules.
