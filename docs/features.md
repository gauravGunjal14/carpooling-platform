# Product features

This document records the planned product scope. Features below are not implemented unless identified as a landing-page demonstration.

## Public landing page (Phase 1)

Introduces the service, passenger and driver journeys, matching concept, trust and safety approach, women-only rides, anonymous seat trust summaries, and planned Pro benefits. Search, scores, ratings, and profile cards are static visual demonstrations; they make no claim of live matching or completed verification.

## Accounts and roles

Passenger and Driver registration, login, JWT sessions, and a basic editable display-name profile are implemented in Phase 2. Admin can log in after secure CLI provisioning and is never self-selected at public signup. Role-based access is checked on the server and client routes. Email verification, password reset, and changes to email/role are not part of this phase.

## Ride management and search (Phase 4)

Drivers can create, view, edit, and cancel their own scheduled rides. Pickup and destination store a selected display name, latitude, longitude, normalized exact-place key, and GeoJSON point. Date/time, 1–6 seats, smoking preference, luggage preference, notes, and Women-only status are validated on the server. Passengers can filter upcoming available rides by exact selected place, date, approximate departure time, and seats; ride detail cards show driver display name and server-derived driving-licence verification only. Admins have read-only ride APIs. There are no bookings, seat reservations, notifications, refunds, or cancellation penalties in this phase.

Women-only ride creation requires an Admin-granted flag on an approved driving-licence verification. Passenger search and detail access require an Admin-granted flag on an approved identity verification. No gender attribute is stored. The server enforces these checks; UI state is only a convenience.

## Smart matching

Explicit public-place search uses a rate-conscious server proxy to OpenStreetMap/Nominatim; users deliberately submit a place query instead of sending each keystroke as autocomplete. Leaflet previews show selected coordinates and a simple connection line. Phase 5 will add coordinate proximity, route compatibility, time and seat matching, ratings, trust signals, booking history, and explainable ranking. The intended radius is 30 km.

## Women-only rides

Drivers may optionally offer women-only rides. Only eligible, verified female passengers may discover and book them. Eligibility and access must be enforced server-side and clearly represented in the product.

## Verification and trust

The platform plans identity and licence verification, verified badges, behavior-based trust scores, ratings, completed-trip history, and an administrative review workflow. Trust scores must not be treated as identity or use protected/sensitive attributes. Occupied seats can reveal an anonymous trust summary before booking, never another passenger’s name, contact details, or identity documents.

## Real-time, safety, and notifications

Later phases may add Socket.io booking updates, notifications, ride status, in-trip SOS broadcasting, admin alerts, and email notifications. Access must be authorized and event payloads minimized.

## Payments and cancellation

Planned payment UI will support a mock flow and an abstraction ready for a provider such as Razorpay, with UPI, card, net banking, and refund workflows. Cancellation rules, including the planned standard 30-hour and Pro 12-hour windows, require clear policy and backend enforcement before launch.

## Pro subscription

Potential benefits include priority listing, premium visibility, and defined cancellation flexibility. Pricing and benefits remain unfinalized.

## Administration

An admin experience is planned for platform statistics, user and ride management, verification review, fraud/trust monitoring, emergency monitoring, reports, and analytics.
