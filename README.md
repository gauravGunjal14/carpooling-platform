# Wayfare — Intelligent Trust-Aware Carpooling Platform

Wayfare is a production-oriented, full-stack MERN carpooling platform designed to deliver safe, transparent, and intelligent shared mobility. Engineered with TypeScript across both the client and server, the system combines real-time ride orchestration, algorithmic route and time compatibility matching, deterministic user trust scoring, administrative document verification, and specialized safety protections such as verified women-only journeys and instant emergency SOS dispatch.

---

## What Makes Wayfare Different?

- **Trust-Aware Carpooling:** Every participant accumulates an algorithmic, deterministic trust score (0–100) based on verified credentials, completed journey history, ratings, and reliability—not opaque estimations.
- **Anonymous Passenger Trust Preview:** Prospective riders can inspect the trust metrics (Trust Score, Verified status, completed trips, average star rating) of occupied seats before booking, with complete preservation of personal privacy (zero exposure of names, emails, phones, or document data).
- **Explainable Smart Matching:** Route compatibility combines Haversine geographic proximity, departure time windows, seat availability, and driver credentials into an explainable percentage score with explicit matching reasons.
- **Verification-Driven Safety:** Drivers and passengers submit government-issued credentials (driving licences and identity documents) reviewed confidentially by platform administrators.
- **Protected Women-Only Rides:** Verified female drivers can designate women-only trips, and only verified female passengers can discover and book them—enforced strictly through backend authorization without storing sensitive gender attributes.
- **End-to-End Real-Time Lifecycle:** Live Socket.IO websockets synchronize booking requests, instant approvals/declines, atomic seat reservations, journey status changes, and in-transit SOS alerts.

---

## Features

### Authentication & Security
- **Role-Based Access Control:** Strict role segregation across `Passenger`, `Driver`, and `Admin` tiers with route-level authorization guards.
- **Dual JWT Token Architecture:** Short-lived access tokens paired with rotating refresh tokens stored in secure, `httpOnly`, `SameSite` cookies.
- **Cryptographic Password Security:** Salting and hashing via `bcryptjs` with timing-safe comparisons.
- **System Protection:** Security headers powered by `Helmet`, CORS origin whitelisting, and Express rate limiting to prevent abuse.

### Smart Ride Matching
- **Geographic Proximity Matching:** Calculates distance using the Haversine formula across pickup and destination coordinates within a configurable radius (up to 30 km).
- **Time Window Compatibility:** Evaluates scheduled departures against preferred passenger travel windows (default ±120 minutes).
- **Multi-Factor Scoring Engine:** Normalizes route proximity, time alignment, seat capacity, and driver verification badges into a composite match percentage.
- **Explainable Transparency:** Surfaces human-readable match explanations (e.g., *"Pickup within 2.1 km"*, *"Verified driver"*, *"Exact destination match"*).

### Ride & Booking Management
- **Driver Ride Publishing:** Interactive place search with OpenStreetMap and Nominatim, Leaflet route visualization, seat pricing, luggage allowance, and smoking rules.
- **Interactive Seat Map:** Visual vehicle layout with selectable seats, real-time availability states, and user seat highlighting.
- **Atomic Seat Reservation:** Race-condition-safe seat locking in MongoDB preventing double-booking during concurrent passenger checkouts.
- **Driver Request Management:** Dedicated dashboard for reviewing incoming seat requests with 1-click acceptance or decline workflows.
- **Full Ride Lifecycle:** Complete state transitions from `scheduled` to `active` (in-progress), `completed`, or `cancelled`.

### Trust & Verification
- **Credential Submission:** Drivers submit driving licences and passengers submit identity documents via multipart uploads.
- **Private Encrypted Storage:** Uploaded verification files are stored privately on the server with SHA-256 integrity checksums, never served publicly.
- **Administrative Review Queue:** Authorized admins inspect credentials, approve/reject submissions, record audit notes, and grant verified status.
- **Deterministic Trust Score:** Calculated transparently from base points, verification bonus, trip completion history, star ratings, and cancellation penalties.
- **Post-Trip Feedback:** Bilateral ratings (1–5 stars) and reviews unlocked automatically upon journey completion.

### Women Safety
- **Dedicated Women-Only Rides:** Drivers can restrict journeys exclusively to eligible women passengers.
- **Backend-Enforced Eligibility:** Access is authorized by an administrative review flag on approved identity documents, avoiding raw gender classification.
- **Filtered Discovery:** Ineligible accounts cannot view, search, or book women-only listings.
- **SOS Emergency Alert System:** Confirmed riders or drivers can trigger emergency alerts during active trips with category classification (`medical`, `accident`, `unsafe_behavior`, `route_deviation`, `general`), real-time socket broadcast, and notification logging.

### Real-Time Features
- **Bidirectional Socket.IO Events:** Live updates for booking submissions, driver acceptance/rejection, cancellations, and trip progression.
- **Dynamic Notifications:** Instant alerts delivered to user notifications and dashboard views without page refresh.
- **Live SOS Dispatch:** Instant alert broadcast to all trip participants and administrators.

### Payments & Notifications
- **Flexible Mock Gateway:** Simulates UPI, Google Pay, PhonePe, credit/debit card, and net banking transactions.
- **Razorpay-Ready Architecture:** Clean separation of payment controllers, transaction references, and webhook abstraction ready for production gateway integration.
- **Automated Refund Logic:** Built-in cancellation refund workflows reflecting platform cancellation windows.
- **Email Notifications:** Transactional emails dispatched via Nodemailer for booking status changes and cancellations.
- **In-App Notification Center:** Unread count indicators, category icons, and mark-as-read functionality.

### Smart Suggestions & Pro Tiers
- **History-Based Recommendations:** Suggests future trips based on passenger travel history and frequent routes.
- **Pro Driver Membership:** Monthly subscription tier unlocking priority ride discovery, exclusive Pro badges, and relaxed cancellation cutoff windows (12 hours vs. standard 30 hours).

### Admin Dashboard
- **Verification Management:** Document queue review with inline PDF/image preview, document approval, rejection feedback, and eligibility grants.
- **Platform Oversight:** APIs for monitoring registered users, active journeys, and platform verification statistics.

---

## Tech Stack

| Layer | Technology | Purpose & Implementation |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19, TypeScript | Reactive, type-safe single-page web client |
| **Build Tool** | Vite 6 | Fast HMR development server and optimized production bundler |
| **Styling & Icons** | Tailwind CSS 4, Lucide React | Modern responsive design system, custom typography, clean iconography |
| **Mapping & Geospatial** | Leaflet, React Leaflet | Interactive vehicle seat layout, map rendering, and route display |
| **Geocoding & Places** | OpenStreetMap, Nominatim | Rate-conscious server-proxied location discovery and search |
| **Backend Runtime** | Node.js (ESM), Express.js | High-performance modular REST API and websocket server |
| **Language** | TypeScript 5 | Strict static typing end-to-end across models, APIs, and client hooks |
| **Database & ODM** | MongoDB, Mongoose 9 | Document storage, geospatial indexing (`2dsphere`), and schema validation |
| **Real-Time Engine** | Socket.IO | Bidirectional event transport for booking events, alerts, and SOS |
| **Authentication** | JWT, bcryptjs, cookie-parser | Access/refresh token lifecycle, password hashing, and secure cookies |
| **Security & Validation** | Zod, Helmet, express-rate-limit | Strict request payload validation, HTTP security headers, and rate limiting |
| **Communications** | Nodemailer | Transactional email delivery for bookings and lifecycle events |
| **Payment Architecture** | Razorpay-ready abstraction | Simulated UPI/Card checkout with scalable refund hooks |
| **Tooling & Monorepo** | npm Workspaces, Prettier, Concurrently | Monorepo task orchestration, code formatting, and parallel execution |

---

## Screenshots

<!-- Add project screenshots here -->

> Place project screenshots inside a `./screenshots/` directory in the repository root to preview them below:

```markdown
![Wayfare Landing Page](./screenshots/landing-page.png)
![Ride Search & Matching](./screenshots/ride-search.png)
![Interactive Seat Map & Anonymous Trust](./screenshots/seat-selection.png)
![Driver Dashboard & Bookings](./screenshots/driver-dashboard.png)
![Administrative Verification Review](./screenshots/admin-verification.png)
```

---

## Project Structure

```text
carpooling-platform/
├── client/                     # Frontend Single Page Application
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── components/         # Reusable UI (Navbar, RideCard, SeatSelector, Maps)
│   │   ├── hooks/              # Custom React hooks (useAuth, useLocation)
│   │   ├── lib/                # API client, auth context helpers
│   │   ├── pages/              # Application views (Search, Driver, Bookings, Admin)
│   │   ├── providers/          # Context providers (AuthProvider, SocketProvider)
│   │   ├── sections/           # Landing page component sections
│   │   ├── types/              # Frontend TypeScript definitions
│   │   ├── App.tsx             # Route registry and access guards
│   │   └── main.tsx            # Application entrypoint
│   └── vite.config.ts
├── server/                     # Backend API & WebSocket Service
│   ├── src/
│   │   ├── config/             # Database and environment configurations
│   │   ├── controllers/        # Request handlers (auth, ride, booking, payment, sos)
│   │   ├── middleware/         # Auth verification, origin check, error handling
│   │   ├── models/             # Mongoose schemas (User, Ride, Booking, Payment, SOS)
│   │   ├── routes/             # Express API route endpoints
│   │   ├── scripts/            # CLI utilities (createAdmin.ts)
│   │   ├── services/           # Business logic (matching, trust, verification, email)
│   │   ├── types/              # Server-side TypeScript interfaces
│   │   ├── utils/              # Application error classes, validators, async handlers
│   │   └── server.ts           # HTTP server and Socket.IO initialization
│   └── tsconfig.json
├── docs/                       # Architecture, features, and milestone documentation
├── AGENTS.md                   # Repository coding standards and formatting rules
├── package.json                # Monorepo workspace configuration
└── README.md                   # Project documentation
```

---

## Getting Started

### Prerequisites

- **Node.js:** v20.19.0+ or v22.12.0+
- **npm:** v10.0.0+
- **MongoDB:** Locally running MongoDB daemon (`mongodb://127.0.0.1:27017`) or MongoDB Atlas cluster connection string

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/carpooling-platform.git
   cd carpooling-platform
   ```

2. **Install all dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy the example environment configuration to `.env`:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and configure your credentials:
   ```env
   NODE_ENV=development
   PORT=4000
   MONGODB_URI=mongodb://127.0.0.1:27017/wayfare
   JWT_ACCESS_SECRET=your_super_secret_access_jwt_key
   JWT_REFRESH_SECRET=your_super_secret_refresh_jwt_key
   CLIENT_ORIGIN=http://localhost:5173
   ```

4. **Provision an Administrator Account:**
   Administrative accounts cannot be registered publicly. Temporarily configure admin credentials in `.env`:
   ```env
   ADMIN_NAME=Admin User
   ADMIN_EMAIL=admin@wayfare.internal
   ADMIN_PASSWORD=YourStrongPassword123!
   ```
   Then execute the administrative provisioning script:
   ```bash
   npm run create-admin
   ```
   *(You can remove `ADMIN_*` environment variables after initial setup).*

5. **Start the development servers:**
   ```bash
   npm run dev
   ```
   This starts:
   - **Frontend Client:** `http://localhost:5173`
   - **Backend API Server:** `http://localhost:4000`

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs both client and server concurrently in development mode |
| `npm run client` | Runs the Vite client development server |
| `npm run server` | Runs the Node.js Express server with live reload (`tsx watch`) |
| `npm run create-admin` | Executes the administrative CLI account provisioning script |
| `npm run build` | Builds both the frontend Vite bundle and server TypeScript code |
| `npm run typecheck` | Validates TypeScript types across both client and server without emitting files |
| `npm run format` | Automatically formats the entire codebase using Prettier |
| `npm run format:check` | Verifies that all files conform to the project's Prettier configuration |

---

## License

This project is licensed under the [MIT License](LICENSE).
