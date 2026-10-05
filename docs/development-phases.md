# Development phases

## Phase 0 — Foundation

Establish the npm workspace monorepo, independent TypeScript client and server packages, development/build/typecheck scripts, and architecture documentation. No authentication, models, or product APIs.

## Phase 1 — Landing page

Deliver the responsive public landing page with static demonstrations of the product’s matching, trust, safety, seat privacy, driver, passenger, and Pro concepts.

## Phase 2 — Authentication

Implemented: Passenger/Driver registration, login, Admin login via provisioned accounts, bcrypt password hashes, rotating JWT sessions, role-aware protected client routes, server authentication/authorization middleware, a safe profile read and display-name update, and the MongoDB user model. Verification and ride features remain in later phases.

## Phase 3 — Verification

Add identity and driver licence submission, protected evidence handling, review workflows, and server-authoritative status.

## Phase 4 — Ride management, locations & maps

Implemented: driver ride creation, editing, cancellation, seats, and ride history; passenger ride details; explicit OSM place search; and Leaflet route previews. Passenger search now uses the Phase 5 coordinate matcher. Booking and seat reservation are not included.

## Phase 5 — Smart matching

Implemented: Haversine pickup/destination distance matching within 30 km at both endpoints, optional ±120-minute departure compatibility, seat/status/date filters, Women-only eligibility enforcement, bounded candidate selection, verified-driver signal, explainable 0–100 match scores, and ranked passenger search results. Booking is not included.

## Phase 6 — Booking

Add ride details, seat selection, booking requests, acceptance/rejection, cancellation, and anonymous occupied-seat trust summaries.

## Phase 7 — Real-time

Add authenticated Socket.io updates for booking and ride events with server-side room authorization.

## Phase 8 — Trust & ratings

Add completed-trip ratings and behavior-based trust signals with transparent, privacy-preserving rules.

## Phase 9 — Payments

Add a payment abstraction, mock payment experience, provider-ready integration, and refunds.

## Phase 10 — Notifications & SOS

Add in-app/email notifications, unread counts, active-ride SOS, co-passenger broadcasts, and admin alerts.

## Phase 11 — Admin

Add protected administration for users, verification, rides, trust/fraud signals, SOS monitoring, reports, and analytics.

## Phase 12 — Testing/security/deployment

Complete automated and manual testing, threat/privacy reviews, observability, production configuration, deployment, and operational readiness.
