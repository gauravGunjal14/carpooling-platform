# Product features

This document records the planned product scope. Features below are not implemented unless identified as a landing-page demonstration.

## Public landing page (Phase 1)

Introduces the service, passenger and driver journeys, matching concept, trust and safety approach, women-only rides, anonymous seat trust summaries, and planned Pro benefits. Search, scores, ratings, and profile cards are static visual demonstrations; they make no claim of live matching or completed verification.

## Accounts and roles

Passengers, drivers, and administrators will have secure accounts, profiles, authentication, and role-based authorization.

## Ride and booking management

Drivers will create, edit, cancel, and manage rides and requests. Passengers will search, select seats, book, cancel, and view booking history. Backend authorization will govern every action.

## Smart matching

Location autocomplete will use OpenStreetMap/Nominatim, with Leaflet maps and coordinate-aware matching. Candidate rides will account for distance, route, departure time, available seats, suitable preferences, ratings, trust signals, and booking history. The intended radius is 30 km. A later service will rank rides and explain recommendations.

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
