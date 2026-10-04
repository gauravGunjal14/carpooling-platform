# Architecture

## Current foundation

The repository uses an npm workspaces monorepo so the React client and Express service can be developed, typechecked, and built independently. Shared TypeScript types can be introduced when real API contracts exist; the current landing page uses static demonstration data only.

## Client and server separation

`client/` contains the Vite, React, TypeScript, Tailwind CSS, and React Router application. Page composition, reusable components, sections, static data, and types live in separate folders. `server/` contains the Node.js and Express TypeScript service foundation. It currently has no product routes or business logic.

## Future API layer

Add versioned Express routes, request validation, controllers, and services in later phases. Keep transport concerns in controllers and domain rules in services. API request/response types should become the contract consumed by a client API module; the UI should not depend directly on persistence models.

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
