# Architecture

## Current foundation

The repository uses an npm workspaces monorepo so the React client and Express service can be developed, typechecked, and built independently. The landing page still uses static demonstration data. Phase 2 adds MongoDB-backed accounts; Phase 3 adds private verification submissions; Phase 4 adds ride management, place search, and maps; Phase 5 adds coordinate-based ride matching.

## Client and server separation

`client/` contains the Vite, React, TypeScript, Tailwind CSS, and React Router application. Page composition, reusable components, sections, static data, and types live in separate folders. `server/` contains the Node.js and Express TypeScript API, configuration, middleware, Mongoose models, controllers, routes, and services.

## Authentication and roles

Public registration accepts Passenger and Driver only. Admin accounts are provisioned with the `npm run create-admin` command and environment variables. Passwords are bcrypt-hashed and never returned. Access JWTs are short-lived and held in client memory; refresh JWTs are rotated and stored only as SHA-256 hashes on the user record, and delivered in an HTTP-only, SameSite Strict cookie. This initial implementation permits one active refresh session per account; signing in again replaces it. Roles are read from the current database account by authentication middleware, and the `authorize` middleware provides server-side role gates for later role-specific APIs. Client route guards are a navigation aid, not the security boundary.

`GET /api/auth/me` returns the signed-in user’s safe profile. `PATCH /api/auth/me` currently permits the account holder to update only their display name. Email and role changes are intentionally outside this phase.

## Future API layer

Express routes, request validation, controllers, and services keep transport concerns separate from domain rules. The client API module consumes JSON request/response contracts; the UI does not depend directly on persistence models. Ride endpoints authorize roles on the server, and driver mutations are scoped to the authenticated driver id.

## Data layer

MongoDB/Mongoose models represent users, verification submissions, and rides. Ride locations store a display label, latitude/longitude, normalized place keys, and GeoJSON points. Ride indexes support scheduled departure/seat filtering and geospatial pickup queries. Search fetches at most 200 scheduled candidates with enough seats and a pickup inside the 30 km radius, then checks destination proximity and eligibility before returning matches. Past and cancelled rides are excluded. Search responses add calculated match metadata and expose only the driver's display name and server-derived driving-licence verification status; document data and women-only eligibility flags remain private.

## Place search and maps

The API proxies explicit place searches to public Nominatim requests using a recognizable application User-Agent, response caching, request coalescing, and a process-wide 1.1-second minimum request interval. The UI requires a deliberate search action; it does not issue Nominatim requests for every keystroke because the public service prohibits autocomplete usage. Do not send residential addresses, personal details, or confidential material. The Leaflet preview uses standard visible map tiles with attribution and an approximate straight-line connection; it does not calculate a navigable or matched route. Nominatim and tile services can be switched later through service/configuration boundaries.

## Future Socket.io layer

Introduce Socket.io after booking flows exist. Authenticate socket connections, authorize room membership on the server, and publish only events visible to their recipients. Real-time messages complement, rather than replace, persisted API state.

## Smart matching engine

The reusable server matching service calculates Haversine distances from stored coordinates, independently checks pickup and destination against a 30 km radius, and only scores scheduled rides that are upcoming and have enough seats. An optional requested time defaults to a ±120-minute compatibility window. Candidate matching and scoring are bounded by a 200-ride pickup-radius query; the destination radius is then checked in code.

The centralized weights are pickup proximity 30, destination proximity 30, requested-time compatibility 20, seat flexibility 10, and approved driver verification 10. Proximity and time factors decrease linearly to zero at their limits. Seat flexibility scores a sufficient ride from 0.5 to 1 based on up to three spare seats. Verification is binary. If the passenger does not specify a time, that factor is omitted and remaining weights are normalized. A Women-only ride is a server-side eligibility gate for both the passenger's approved identity submission and driver's approved licence submission; it is not a score factor. Trust scores and ratings are not available yet, so the matcher does not invent them.

Search result reasons are generated from actual distances, the requested time difference, seat sufficiency, and current driver verification. Results are sorted by score, route distance, then departure time. The score weights and candidate limit are centralized in the matching service for later tuning.

## Future trust engine

Keep trust inputs transparent, behavior-based, and separate from identity attributes. Do not use protected or sensitive attributes as score inputs. The server will calculate and expose only the authorized trust summary needed by each interface.

## Future verification system

Verification state must be authoritative on the server, with least-privilege access to sensitive evidence, secure review workflows, retention limits, and audit trails. Avoid collecting or exposing Aadhaar data unless a defined lawful requirement makes it necessary. Women-only eligibility is an Admin-granted flag stored on the approved verification submission; ride creation and passenger discovery check both this flag and the role-appropriate approved verification on the server. Frontend eligibility checks are presentation only.
