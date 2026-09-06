# RuralBus SaaS: Master System Architecture Document

## 1. Executive Summary & Core Architectural Principles

**RuralBus** is a multi-tenant Software-as-a-Service (SaaS) transportation platform engineered for regional and rural bus transport operators. The platform empowers bus operators to manage fleets, routes, schedules, personnel, and ticketing, while enabling passengers to discover routes, track buses in real time, and purchase digital tickets.

### Core Architectural Principles
1. **Zero Cross-Tenant Leakage**: Multi-tenancy is enforced at both the database layer (PostgreSQL Row-Level Security with transaction-scoped context) and application layer middleware. Client-supplied tenant IDs are never trusted.
2. **Exactly ONE React Native Mobile App**: A single mobile codebase serves Passengers, Drivers, and Conductors. The backend-authenticated user role strictly determines navigation, interface modes, and permissions.
3. **Database as Authoritative Source of Truth**: PostgreSQL is the single source of truth for inventory, bookings, and state. In-memory layers (Redis) act as transient performance accelerators, pub/sub brokers, and ephemeral caches, never replacing ACID guarantees.
4. **Resilience to Rural Connectivity**: Intermittent connectivity is solved via pre-departure manifest caching, cryptographically verifiable offline QR ticket validation, and client-side GPS dead-reckoning/telemetry buffering.
5. **Localhost-First Development**: The entire platform runs locally with minimal infrastructure (PostgreSQL/PostGIS + Redis in Docker; API, Admin Web, and Mobile running directly on the host machine).
6. **Strict Separation of MVP vs Phase 2**: Complex offline financial reconciliation (e.g., offline cash ticket issuance) is cleanly separated from the core MVP to ensure a rock-solid, production-grade foundation.

---

## 2. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Clients ["Client Applications"]
        RN_App["Single React Native Mobile App\n(Passenger / Driver / Conductor Dynamic Modes)"]
        Admin_Web["Operator Admin Web Portal\n(React + TypeScript + Vite)"]
    end

    subgraph Edge ["Network & Ingress (Localhost / Gateway)"]
        Gateway["Reverse Proxy / Fastify Gateway\n(http://localhost:4000)"]
    end

    subgraph Backend ["Node.js Backend Engine (Fastify + TypeScript)"]
        API_Server["Fastify Core HTTP & WS Server"]
        Auth_Module["Auth & RBAC Module (JWT / Refresh)"]
        Tenant_Module["Tenant Resolver & Isolation Middleware"]
        Fleet_Module["Fleet, Route & Stop Service"]
        Dispatch_Module["Trip Dispatch & Schedule Service"]
        Geo_WS_Module["Real-Time Tracking & WebSocket Hub"]
        Booking_Module["Booking & Seat Locking Service"]
        Payment_Module["Payment Webhook & Razorpay Service"]
        Ticket_Module["Ticket Signing & QR Manifest Service"]
    end

    subgraph Storage ["Authoritative Storage & In-Memory Layer"]
        PG[("PostgreSQL 16 + PostGIS\n(Authoritative Data Store + Transactional RLS)")]
        Redis[("Redis 7 (In-Memory Accelerator)\n- WebSocket Pub/Sub Channels\n- Live Fleet Geospatial Index (GEOADD)\n- Fast-Path Seat Hold & Refresh Token Whitelist\n- Telemetry Stream Buffer")]
    end

    subgraph External ["External Service Adapters (Abstracted)"]
        Map_Provider["Map Service Adapter\n(Mapbox / Google Maps)"]
        Razorpay_API["Payment Gateway Adapter\n(Razorpay Orders / Webhooks)"]
        FCM["Push Notification Adapter\n(Firebase Cloud Messaging - Phase 2)"]
    end

    RN_App -->|HTTPS REST / WSS Telemetry| Gateway
    Admin_Web -->|HTTPS REST / WSS Fleet Radar| Gateway

    Gateway --> API_Server

    API_Server --> Auth_Module
    API_Server --> Tenant_Module
    API_Server --> Fleet_Module
    API_Server --> Dispatch_Module
    API_Server --> Geo_WS_Module
    API_Server --> Booking_Module
    API_Server --> Payment_Module
    API_Server --> Ticket_Module

    Auth_Module & Tenant_Module & Fleet_Module & Dispatch_Module & Booking_Module & Payment_Module & Ticket_Module -->|Transactional SET LOCAL RLS| PG
    Geo_WS_Module & Booking_Module & Auth_Module -->|Pub/Sub, GeoIndex, Fast Hold| Redis

    Fleet_Module --> Map_Provider
    Payment_Module --> Razorpay_API
    Booking_Module -.-> FCM
```

---

## 3. Technology Selection Rationale

### 3.1 Backend: Node.js with Fastify & TypeScript
* **High Throughput & Low Latency**: Fastify uses `find-my-way` (a highly optimized radix-tree router) and an efficient internal lifecycle, delivering significantly higher request throughput and lower latency compared to legacy frameworks like Express.
* **Compiled JSON Schema Validation & Serialization**: Fastify natively compiles JSON schemas using `fast-json-stringify` and Ajv/TypeBox. This provides automatic request validation and serializes responses up to 2x faster than standard `JSON.stringify`.
* **Encapsulated Plugin Hierarchy (`fastify-plugin`)**: Fastify's directed acyclic graph (DAG) plugin model allows precise scoping of decorators, hooks (`onRequest`, `preHandler`), and middleware. This ensures tenant context, authentication state, and database transaction sessions are cleanly isolated without global state pollution.
* **Native TypeScript Support**: First-class TypeScript definitions for request bodies, query params, headers, and route replies, minimizing boilerplate and ensuring end-to-end type safety.
* **Built-in High-Performance Structured Logging**: Fastify deeply integrates `pino`, providing asynchronous JSON logging with request correlation IDs (`req.id`) and near-zero overhead.

### 3.2 Database: PostgreSQL 16 + PostGIS & Drizzle ORM
* **Authoritative ACID Truth**: All financial, booking, seating, and entity state transitions are guaranteed by PostgreSQL transactions and relational integrity.
* **PostGIS Geospatial Engine**: Bus routes, geo-fenced stops, nearest-stop lookups, and corridor spatial searches use native PostGIS spatial types (`geometry(Point, 4326)`, `geometry(LineString, 4326)`) and spatial indexes (GiST).
* **Drizzle ORM**:
  * **Zero Runtime Overhead**: Emits direct parameterized SQL without heavy external binary query engines.
  * **Native Spatial Support**: Supports custom PostGIS types and operators cleanly.
  * **Explicit Transaction & SQL Control**: Enables explicit database transaction control required for `SET LOCAL` tenant configuration and row-level locking (`FOR UPDATE`).

### 3.3 Ephemeral Caching & Real-Time Hub: Redis 7
* **Transient Fast-Path Seat Hold**: Acts as a high-speed temporary reservation layer before booking finalization in PostgreSQL.
* **WebSocket Cluster Pub/Sub**: Routes live vehicle telemetry from driver sockets to passenger and admin room subscribers.
* **Live Fleet Geospatial Indexing**: Uses Redis `GEOADD` and `GEOSEARCH` to maintain live fleet coordinates in memory for real-time admin radar queries without querying PostgreSQL every 3 seconds.
* **Stream Buffer for GPS Telemetry**: Buffers telemetry points for asynchronous downsampling and trajectory compression before writing historical summaries to PostgreSQL.

---

## 4. Multi-Tenancy & Data Isolation Model

### 4.1 Tenancy Hierarchy
The platform strictly differentiates between platform-level users and tenant-scoped members:

1. **Passenger**:
   * **Platform-Level User**: A passenger has an account at the platform level and can discover routes, check schedules, and purchase tickets from *any* registered bus operator.
   * A passenger account has no static `tenant_id`.
   * When a passenger books a ticket, the resulting `bookings` and `tickets` records explicitly store the `tenant_id` of the operating company that runs the trip.
2. **Operator Admin**:
   * **Tenant-Scoped User**: Belongs to exactly one transport operator (`tenant_id`).
   * Has full administrative control over that tenant's fleet, staff, routes, schedules, and financial reports.
3. **Driver**:
   * **Tenant-Scoped User**: Employed by exactly one transport operator (`tenant_id`).
   * Can only view and operate trips dispatched by their employer.
4. **Conductor**:
   * **Tenant-Scoped User**: Employed by exactly one transport operator (`tenant_id`).
   * Can only access passenger manifests and validate tickets for trips dispatched by their employer.

```mermaid
classDiagram
    class User {
        UUID id
        String email
        String phone
        String passwordHash
        Enum userRole (PASSENGER, PLATFORM_ADMIN)
        Timestamp createdAt
    }

    class Operator {
        UUID id (tenant_id)
        String companyName
        String businessCode
        Enum status (ACTIVE, SUSPENDED)
    }

    class OperatorMember {
        UUID id
        UUID userId
        UUID tenantId
        Enum memberRole (OPERATOR_ADMIN, DRIVER, CONDUCTOR)
        Boolean isActive
    }

    class Bus {
        UUID id
        UUID tenantId
        String registrationNumber
        Int totalSeats
    }

    class Route {
        UUID id
        UUID tenantId
        String routeCode
        String origin
        String destination
    }

    class Trip {
        UUID id
        UUID tenantId
        UUID routeId
        UUID busId
        UUID driverId
        UUID conductorId
        Timestamp scheduledDeparture
        Enum status
    }

    class Booking {
        UUID id
        UUID tenantId
        UUID tripId
        UUID passengerId
        Int seatNumber
        Enum status (HELD, CONFIRMED, CANCELLED)
        Timestamp lockedUntil
    }

    User "1" -- "0..1" OperatorMember : staff profile in
    Operator "1" -- "0..*" OperatorMember : employs
    Operator "1" -- "0..*" Bus : owns
    Operator "1" -- "0..*" Route : operates
    Operator "1" -- "0..*" Trip : dispatches
    Trip "1" -- "0..*" Booking : contains
    User "1" -- "0..*" Booking : places
```

### 4.2 Tenant Isolation & Trust Boundary
* **Zero Client Trust**: A `tenant_id` supplied in request bodies, headers, or query parameters by mobile or web clients is **never trusted**.
* **Authoritative Extraction**:
  * For Operator Staff (Admins, Drivers, Conductors), the backend derives `tenant_id` solely from verified cryptographic JWT claims issued upon backend authentication.
  * For Passenger actions (e.g. creating a booking), the backend queries the authoritative `trips` record to extract the verified `tenant_id` for that trip.

---

## 5. Database Row-Level Security (RLS) & Connection Pooling

In a pooled Node.js environment (e.g., `pg.Pool`), database connections are reused across different requests and tenants. If session variables are set globally on a connection (e.g. via `SET app.current_tenant_id = '...'`), the context persists when the connection returns to the pool, resulting in catastrophic cross-tenant data leaks.

### 5.1 The Transaction-Scoped `SET LOCAL` Architecture
To guarantee zero pool contamination, all tenant-scoped database operations must execute within an explicit database transaction utilizing `SET LOCAL`:

```
┌─────────────────────────────────────────────────────────────┐
│ Fastify Request Lifecycle                                  │
│                                                             │
│ 1. Authenticate Request -> Extract tenantId from JWT        │
│ 2. Check out connection from pg.Pool                        │
│ 3. Execute: BEGIN;                                          │
│ 4. Execute: SELECT set_config('app.current_tenant_id',      │
│                               :tenantId, true);             │
│    (3rd param `true` scopes setting strictly to this TX)    │
│ 5. Execute Drizzle ORM Queries / Mutations                  │
│    (PostgreSQL RLS filters rows matching current_setting)   │
│ 6. Execute: COMMIT (or ROLLBACK on error);                  │
│ 7. Return connection to pool (Setting automatically wiped)  │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Drizzle ORM Transaction Wrapper
We implement a typed, fail-safe wrapper in the backend database layer:

```typescript
import { sql } from 'drizzle-orm';
import { db, DrizzleTransaction } from '@ruralbus/database';

/**
 * Executes a callback within a tenant-isolated database transaction.
 * Uses `is_local = true` so `app.current_tenant_id` is automatically cleared on COMMIT/ROLLBACK.
 */
export async function withTenant<T>(
  tenantId: string,
  callback: (tx: DrizzleTransaction) => Promise<T>
): Promise<T> {
  if (!tenantId) {
    throw new Error('Tenant context missing for tenant-scoped operation');
  }

  return db.transaction(async (tx) => {
    // Parameterized call to set_config with is_local = true
    await tx.execute(
      sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`
    );
    return callback(tx);
  });
}
```

### 5.3 PostgreSQL RLS Policy Definitions
Each tenant-owned table (`buses`, `routes`, `stops`, `schedules`, `trips`, `operator_members`, `bookings`, `tickets`) has Row-Level Security enabled and enforced for the application role:

```sql
-- 1. Create dedicated non-superuser application role
CREATE ROLE ruralbus_app WITH LOGIN PASSWORD 'app_secure_password';
GRANT CONNECT ON DATABASE ruralbus TO ruralbus_app;
GRANT USAGE ON SCHEMA public TO ruralbus_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ruralbus_app;

-- 2. Enable RLS on multi-tenant tables
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- 3. Define strict RLS Policy (Default-Deny if app.current_tenant_id is unset/empty)
CREATE POLICY tenant_isolation_policy ON buses
    FOR ALL
    TO ruralbus_app
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    );
```

**Default-Deny Behavior**: If a query is executed without setting `app.current_tenant_id`, `current_setting('app.current_tenant_id', true)` returns `NULL`. The expression `tenant_id = NULL` evaluates to `FALSE` in SQL, preventing any rows from being read or modified.

---

## 6. Single React Native Mobile Application Architecture

There is **exactly ONE React Native mobile application** (`apps/mobile`). It supports all three user roles: **Passenger**, **Driver**, and **Conductor**.

### 6.1 State-Driven Dynamic Navigation
The mobile application uses React Navigation with a root navigator dynamically controlled by the authenticated user's profile state stored in a persistent Zustand store (backed by MMKV):

```mermaid
flowchart TD
    AppStart([App Launch]) --> CheckAuth{Is Authenticated?}
    
    CheckAuth -- No --> AuthNav[Auth Navigator\n- Login Screen (Unified)\n- Passenger Registration\n- Forgot Password]
    
    CheckAuth -- Yes --> RoleSwitch{auth.user.role}
    
    RoleSwitch -- PASSENGER --> PassNav[Passenger Navigator\n- Route Discovery & Search\n- Live Bus Map (GPS Stream)\n- Seat Selection Grid\n- Razorpay Payment Modal\n- Digital Ticket Wallet (QR Code)\n- Booking History]
    
    RoleSwitch -- DRIVER --> DriverNav[Driver Navigator\n- Assigned Trips for Today\n- Live Trip HUD (Start / Stop Trip)\n- Background GPS Telemetry Engine\n- Incident / Delay Broadcast]
    
    RoleSwitch -- CONDUCTOR --> CondNav[Conductor Navigator\n- Pre-Departure Trip Manifest Download\n- Vision Camera QR Ticket Scanner\n- Offline QR Validation Engine\n- Live Boarding / Seat Occupancy Grid]
```

### 6.2 Role Security & Client Integrity
* The mobile application cannot arbitrarily switch roles. The navigation state is strictly locked to the role signed inside the backend JWT.
* If a user logs out, all role-specific in-memory states and local sensitive caches are cleared.
* Common UI design tokens, networking clients, camera abstractions, and geolocation modules are shared across all three feature folders inside `apps/mobile/src/features/`.

---

## 7. Booking & Seat-Locking Architecture

### 7.1 PostgreSQL as the Authoritative Source of Truth
PostgreSQL is the single, authoritative source of truth for seat availability and booking state. Redis serves as an optional, high-throughput fast-path cache to reduce database contention during high-traffic booking windows.

### 7.2 Responsibility Separation: Redis vs PostgreSQL

| Capability | Redis Role | PostgreSQL Role (Authoritative) |
| :--- | :--- | :--- |
| **Seat Availability** | Fast-path key cache for immediate UI feedback | Authoritative state of all `HELD` and `CONFIRMED` seats |
| **Temporary Lock** | `SET lock:trip:<tripId>:seat:<num> <userId> NX EX 300` | `bookings` row with `status = 'HELD'` and `locked_until = NOW() + INTERVAL '5 minutes'` |
| **Double-Booking Defense**| Fast pre-check (returns `409` before DB hit) | Database Unique Partial Index: `CREATE UNIQUE INDEX idx_active_seat ON bookings (trip_id, seat_number) WHERE status IN ('HELD', 'CONFIRMED');` |
| **Expiration** | Key auto-expires via TTL (300 seconds) | Lazy expiration on query (`WHERE locked_until > NOW()`) + background cleanup worker |
| **System Crash** | Keys may be lost if Redis restarts; recovered from DB | Completely durable; ACID transaction commits ensure zero data loss |

```mermaid
sequenceDiagram
    autonumber
    actor Passenger as Passenger App
    participant API as Fastify API
    participant Redis as Redis (Fast Hold)
    participant PG as PostgreSQL (Authoritative)
    participant Razorpay as Razorpay Gateway

    Passenger->>API: POST /api/v1/bookings/hold-seat { tripId, seatNumber }
    
    Note over API, Redis: Fast-Path Pre-Check
    API->>Redis: SET `hold:trip:<tripId>:seat:<num>` <userId> NX EX 300
    alt Redis Key Already Exists
        Redis-->>API: Key exists (Locked)
        API-->>Passenger: 409 Conflict ("Seat is currently reserved")
    else Redis Lock Granted
        Redis-->>API: OK
        Note over API, PG: Authoritative ACID Hold in DB
        API->>PG: BEGIN;
        API->>PG: SELECT * FROM bookings WHERE trip_id = :tripId AND seat_number = :num AND (status = 'CONFIRMED' OR (status = 'HELD' AND locked_until > NOW())) FOR UPDATE;
        alt Seat Already Booked/Held in DB
            API->>PG: ROLLBACK;
            API->>Redis: DEL `hold:trip:<tripId>:seat:<num>`
            API-->>Passenger: 409 Conflict ("Seat unavailable")
        else Seat Available
            API->>PG: INSERT INTO bookings (trip_id, passenger_id, seat_number, status, locked_until) VALUES (:tripId, :userId, :num, 'HELD', NOW() + INTERVAL '5 min') RETURNING id;
            API->>PG: COMMIT;
            API->>Razorpay: Create Order { amount, receipt: bookingId }
            Razorpay-->>API: Return { orderId, amount }
            API-->>Passenger: 200 OK { bookingId, razorpayOrderId, lockedUntil }
        end
    end

    Note over Passenger, Razorpay: Passenger completes payment
    Passenger->>API: POST /api/v1/bookings/verify-payment { bookingId, razorpayPaymentId, signature }
    API->>API: Verify HMAC SHA256 Signature
    API->>PG: BEGIN;
    API->>PG: UPDATE bookings SET status = 'CONFIRMED', locked_until = NULL WHERE id = :bookingId AND status = 'HELD';
    API->>PG: INSERT INTO tickets (booking_id, qr_signature, ...) VALUES (...);
    API->>PG: COMMIT;
    API->>Redis: DEL `hold:trip:<tripId>:seat:<num>`
    API-->>Passenger: 200 OK + Digital Ticket (QR)
```

---

## 8. Conductor System: Validation vs Issuance

To maintain high reliability, ticket validation and ticket issuance are treated as distinct architectural domains.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           CONDUCTOR SUBSYSTEM                            │
├────────────────────────────────────────┬─────────────────────────────────┤
│ A. OFFLINE QR TICKET VALIDATION        │ B. OFFLINE CASH TICKET ISSUANCE │
│    (Core MVP Feature)                  │    (Phase 2 Feature)            │
├────────────────────────────────────────┼─────────────────────────────────┤
│ • Pre-departure manifest sync          │ • Sequential ticket numbering   │
│ • Cryptographic JWS / Ed25519 signature│ • Device & Conductor identity   │
│ • Local SQLite scan duplicate check    │ • Cryptographic hash chaining   │
│ • Read-only verification in dead zones │ • Unreserved / Quota capacity   │
│ • Low operational & financial risk     │ • Post-trip cash reconciliation │
└────────────────────────────────────────┴─────────────────────────────────┘
```

### 8.1 Feature A: Offline QR Ticket VALIDATION (Core MVP)
* **Architecture**:
  1. **Asymmetric Cryptography**: Digital tickets generated upon payment confirmation contain a compact JSON Web Signature (JWS) signed by the backend using a private key (Ed25519 / ECDSA).
  2. **Pre-Departure Manifest Sync**: Before leaving the bus terminal, the conductor's app downloads the complete passenger manifest for the assigned trip into local encrypted storage (SQLite / WatermelonDB).
  3. **Offline Validation Engine**: In cellular dead zones, the conductor scans the passenger's QR code. The app performs two checks:
     * Validates the cryptographic signature using the backend's public key (embedded in the app).
     * Checks the ticket ID against the local trip manifest and marks the passenger as `BOARDED` with a local timestamp.
  4. **Duplicate Prevention**: If the same QR code is presented twice on the same bus, the local SQLite database detects the prior `BOARDED` status and sounds an alert.
  5. **Post-Trip Sync**: When network connectivity is restored, the local boarding log is synchronized back to the backend.
* **Risk Assessment**: Extremely low risk. Manifest is read-only during the trip; cryptographic verification prevents ticket forgery without requiring live internet.

### 8.2 Feature B: Offline CASH Ticket ISSUANCE (Phase 2 Roadmap)
* **Architecture & Safe Reconciliation Model**:
  1. **Deterministic Unique Numbering**: Each offline ticket is issued with a deterministic, monotonic sequence format:
     `TKT-<OPERATOR_CODE>-<DEVICE_UUID_PREFIX>-<TRIP_ID>-<LOCAL_SEQ_NUM>` (e.g. `TKT-EXP-DEV01-TRP402-0042`).
  2. **Device & Conductor Binding**: The device UUID and authenticated Conductor ID are cryptographically embedded in every issued ticket record.
  3. **Capacity & Conflict Model**: To avoid selling a seat already booked online, offline cash tickets must either:
     * Be restricted to an unreserved / standing quota, OR
     * Only allocate seat numbers explicitly marked as `UNSOLD` in the pre-departure downloaded manifest.
  4. **Tamper-Proof Audit Chaining**: Each offline ticket generates a cryptographic hash chain: `hash_n = SHA256(hash_{n-1} + ticket_data)`. If a conductor attempts to delete or alter an offline ticket record locally, the hash chain breaks upon server reconciliation.
  5. **Reconciliation & Settlement**:
     * Upon reconnecting, the app transmits an idempotent batch payload: `POST /api/v1/conductors/trips/:tripId/offline-tickets/sync`.
     * The server processes the batch inside a single database transaction, inserting tickets, creating financial audit logs, and flagging any sequence gaps.
     * Cash collected is verified against physical cash deposited at the depot during end-of-day duty settlement.
* **Risk Assessment & Recommendation**: Offline cash issuance introduces financial discrepancy risks, inventory race conditions, and physical cash settlement overhead. **This feature is cleanly deferred to Phase 2.**

---

## 9. GPS Telemetry & Real-Time Tracking Architecture

To avoid database bloat and performance degradation, high-frequency GPS telemetry is cleanly separated across three distinct processing pipelines:

```mermaid
flowchart LR
    subgraph Ingestion ["1. Driver Ingestion"]
        Driver["Driver Mobile App"] -->|WSS Ping (every 3s)| WSHub["Fastify WebSocket Hub"]
    end

    subgraph FastPath ["2. Real-Time Distribution (Redis)"]
        WSHub -->|Publish `channel:trip:<id>`| RedisPubSub["Redis Pub/Sub\n(Passenger Live Map)"]
        WSHub -->|GEOADD `fleet:<tenantId>`| RedisGeo["Redis Geospatial\n(Admin Fleet Radar)"]
        WSHub -->|XADD `stream:gps:<tripId>`| RedisStream["Redis Stream Buffer\n(Raw Points)"]
    end

    subgraph BatchSink ["3. Historical Storage (PostgreSQL)"]
        RedisStream -->|Downsample & Compress\nat Trip End| Worker["Trajectory Worker"]
        Worker -->|Single LineString Insert| PG_History[("PostgreSQL\n`trip_trajectories`\n(PostGIS LineString)")]
    end
```

### 9.1 The Three GPS Streams Explained

1. **Real-Time Passenger Tracking**:
   * **Purpose**: Passengers tracking the single bus they are waiting for or riding on.
   * **Mechanism**: Driver sends GPS ping every 3 seconds over WebSocket. Fastify publishes the coordinate to Redis Pub/Sub channel `channel:trip:<tripId>`. Fastify forwards the message exclusively to passengers connected to that trip room.
   * **Database Impact**: Zero PostgreSQL writes.

2. **Admin Live Fleet Tracking**:
   * **Purpose**: Operator dispatchers monitoring the live positions, speeds, and statuses of all active buses on an interactive map.
   * **Mechanism**: Fastify updates the tenant's live fleet geospatial key: `GEOADD active_fleet:<tenantId> <lng> <lat> <busId>`. The Admin Web dashboard queries `GEOSEARCH` or receives batched updates over WebSockets every 3-5 seconds.
   * **Database Impact**: Zero PostgreSQL writes.

3. **Historical GPS Storage & Auditing**:
   * **Purpose**: Route adherence auditing, schedule compliance, dispute resolution, and trip playback.
   * **PostgreSQL Storage Strategy**: Raw 3-second pings are **never stored permanently as individual rows** in PostgreSQL. Storing 1,000 pings per hour per bus would bloat the database with millions of rows.
   * **Efficient Strategy**:
     * Raw coordinates are buffered in a transient Redis Stream (`stream:gps:<tripId>`) with a 24-hour TTL.
     * When the driver marks the trip as `COMPLETED`, a background worker reads the stream, applies the Ramer-Douglas-Peucker (RDP) polyline simplification algorithm to downsample redundant points, and saves the final trajectory as a single PostGIS `LineString` record in `trip_trajectories`.

---

## 10. Localhost-First Infrastructure Specification

The entire development environment is designed to run locally with zero external cloud dependencies:

```
┌────────────────────────────────────────────────────────────────────────┐
│ LOCALHOST ENVIRONMENT                                                  │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Docker Compose Containers (Background Services)                    │
│    ├── postgres:16-postgis (Port: 5432)                               │
│    └── redis:7-alpine       (Port: 6379)                               │
│                                                                        │
│ 2. Host Machine Direct Node.js Processes (Managed by pnpm / Turborepo) │
│    ├── apps/api    -> Fastify Backend Server (http://localhost:4000)   │
│    ├── apps/admin  -> React + Vite Dashboard (http://localhost:5173)   │
│    ├── apps/mobile -> React Native Metro     (http://localhost:8081)   │
│    └── packages/*  -> Drizzle Studio, Shared Packages                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Environment Variables (.env.example)
```env
# Database & Cache (Docker Services)
DATABASE_URL=postgresql://ruralbus_app:app_secure_password@localhost:5432/ruralbus
REDIS_URL=redis://localhost:6379

# Fastify Server
PORT=4000
HOST=0.0.0.0
NODE_ENV=development
JWT_SECRET=super_secret_jwt_signing_key_32_chars_minimum
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d

# Payment Adapter (Razorpay Test Keys or Mock Mode)
RAZORPAY_KEY_ID=rzp_test_mock_key
RAZORPAY_KEY_SECRET=rzp_test_mock_secret
PAYMENTS_MODE=mock # 'mock' for local dev, 'razorpay' for live test

# Map Provider Adapter (Mapbox / Google Maps / Mock)
MAP_PROVIDER=mock # 'mock' returns synthetic polylines locally
```

---

## 11. MVP Boundary vs Phase 2 Scope

| Feature / Domain | MVP (Phases 1 - 15) | Phase 2 / Future Roadmap |
| :--- | :--- | :--- |
| **Mobile App** | Single React Native App (Passenger, Driver, Conductor) | Native Bluetooth POS Thermal Printer Integration |
| **Multi-Tenancy** | PostgreSQL RLS with `SET LOCAL` Transaction Wrapper | Automated Multi-Tenant SaaS Billing & Subscriptions |
| **Conductor Mode** | Offline QR Ticket Validation (Pre-synced manifest + Ed25519) | Offline Cash Ticket Issuance & Financial Reconciliation |
| **GPS Telemetry** | Redis Pub/Sub + Redis Geo + PostGIS `LineString` Sink | Machine Learning ETA Prediction with Traffic Models |
| **Seat Booking** | PostgreSQL ACID Locking + Redis Fast Hold | Dynamic Fare Pricing & Surge Engine |
| **Payments** | Razorpay Test Gateway & Server Webhook Verification | Multi-split Operator Automated Payouts |
| **Notifications**| In-app alerts & WebSocket events | Production Firebase Cloud Messaging (FCM) & SMS OTP |

---

## 12. Security & Compliance Blueprint

1. **Authentication & Cryptography**:
   * Passwords hashed using Argon2id with cryptographically secure salts.
   * Access tokens: Short-lived JWTs (15 minutes); Refresh tokens: Cryptographic random strings stored in Redis with revocation capability.
   * Digital tickets: Signed using Ed25519 asymmetric keypairs.
2. **Input Validation & Sanitization**:
   * All API routes strictly validate headers, params, and bodies using JSON Schema / TypeBox / Zod.
   * Unknown payload properties are automatically stripped (`additionalProperties: false`).
3. **Rate Limiting & Abuse Prevention**:
   * Fastify rate-limiter applied per IP and per User ID for auth and booking routes.
   * WebSocket message throttling per driver socket.
