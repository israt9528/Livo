# Livo — Housing & Roommate Management System API

A scalable, secure, and production-ready RESTful backend built with Node.js, Express, TypeScript, Prisma ORM, and PostgreSQL. The system orchestrates the entire shared housing lifecycle: tenant and owner onboarding, roommate preference matching, rental unit and room discovery, automated lease workflows, utility bill splitting, Stripe payment processing, and Cloudinary media pipelines.

---

## Live url : https://assignment-6-beta-blond.vercel.app

## Tech Stack & Architecture

- **Runtime & Language:** Node.js (v20+ LTS), TypeScript
- **Web Framework:** Express.js
- **Database & ORM:** PostgreSQL, Prisma ORM
- **In-Memory Cache & Session Store:** Redis (`redis` v4 / `ioredis`)
- **Cloud Media Storage:** Cloudinary SDK (Direct memory buffer streams with automated asset lifecycle management)
- **Payment Processing:** Stripe SDK (PaymentIntents & HMAC webhook signature verification)
- **Email Delivery:** Nodemailer (SMTP) with EJS templating
- **Validation & Security:** Zod, Helmet, CORS, Express Rate Limit, bcrypt (password hashing), JWT (access & refresh rotation with SHA-256 hash comparison)
- **Containerization & CI/CD:** Multi-stage Docker build, Docker Compose, GitHub Actions

### Layered Architecture Pattern

```text
HTTP Request
     │
     ▼
[ Routing & Middlewares ] ─── (CORS, Helmet, Rate Limiter, Auth Guards, Zod Validation)
     │
     ▼
[ Controllers ]           ─── (Request parsing, HTTP status mapping, Standardized JSON responses)
     │
     ▼
[ Services ]              ─── (Business logic, atomic transactions, Stripe, Cloudinary, Redis)
     │
     ▼
[ Prisma ORM / DB ]       ─── (PostgreSQL relational data modeling, query optimization)
```

---

## Core Features

- **Multi-Role RBAC:** Granular Role-Based Access Control enforcing permissions across `TENANT`, `OWNER`, and `ADMIN` roles.
- **Cryptographic Token Rotation:** Dual-token authentication (short-lived access tokens, long-lived refresh tokens) with SHA-256 token hash storage to detect and mitigate token theft or replay attacks.
- **Two-Step Password Recovery:** Numeric 6-digit OTP generation with Redis TTL (5 minutes) and styled transactional email alerts rendered via EJS.
- **Media Asset Lifecycle:** Multipart upload handling via Multer into memory streams, direct Cloudinary uploads, and automatic deletion of old assets on avatar replacement.
- **Inventory & Discovery Engine:** Paginated search, filtering (price range, room types, availability), and nested relational population for rental properties and units.
- **Financial Ledger & Webhooks:** Stripe payment intent processing with raw body capture to support strict HMAC-SHA256 signature verification and atomic transaction records.
- **Audit Logging:** System-wide audit trails recording user mutations, IP addresses, resource IDs, and old/new state diffs.
- **Production Hardening:** Multi-stage Alpine Docker build running under an unprivileged `node` user, deep `/api/v1/health` checks, and graceful shutdown handlers (`SIGTERM`/`SIGINT`).

---

## Directory Structure

```text
├── .github/
│   └── workflows/
│       └── ci-cd.yml           # Automated lint, typecheck & GHCR deployment
├── prisma/
│   ├── schema.prisma           # Relational schema and indexing
│   └── migrations/             # SQL schema migrations
├── src/
│   ├── app/
│   │   ├── middleware/         # Auth, Zod validation, Rate limiting, Error handlers
│   │   ├── modules/            # Domain modules (routes, controllers, services, validation)
│   │   │   ├── auth/           # Login, register, token rotation, OTP password recovery
│   │   │   ├── user/           # Profiles, preference matching, avatar management
│   │   │   ├── unit/           # Property units and nested rooms
│   │   │   ├── payment/        # Stripe intents and webhook handlers
│   │   │   └── health/         # DB & Redis connectivity diagnostics
│   │   ├── routes/             # Centralized application router
│   │   └── utils/              # AppError, catchAsync, sendResponse, password helpers
│   ├── config/                 # Environment variable validation
│   ├── lib/                    # Shared singletons (Prisma, Redis, Cloudinary, Nodemailer)
│   ├── templates/              # EJS transactional email templates
│   ├── app.ts                  # Express setup, security middlewares, webhook routing
│   └── server.ts               # HTTP bootstrap and graceful termination
├── Dockerfile                  # Multi-stage production container spec
├── docker-compose.yml          # Container orchestration (API, Postgres, Redis)
└── tsconfig.json               # TypeScript compiler configuration
```

---

## Environment Variables

Create a `.env` file in the root directory and configure the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
CLIENT_URL="http://localhost:3000"

# Database Configuration (PostgreSQL)
DATABASE_URL="postgresql://postgres:password@localhost:5432/housing_db?schema=public"

# Cryptography & JWT Secrets (Min 32 characters)
JWT_ACCESS_SECRET="your_secure_jwt_access_secret_min_32_chars"
JWT_ACCESS_EXPIRES_IN="1d"
JWT_REFRESH_SECRET="your_secure_jwt_refresh_secret_min_32_chars"
JWT_REFRESH_EXPIRES_IN="7d"
BCRYPT_SALT_ROUNDS=10

# Cloudinary CDN Configuration
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"

# Redis Cache Configuration
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
REDIS_PASSWORD=""

# SMTP / Email Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-16-digit-app-password"
EMAIL_FROM="Livo Support <no-reply@housingplatform.com>"

# Stripe Payment Gateway
PAYMENT_GATEWAY="STRIPE"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

## Installation & Local Setup

### Prerequisites

- Node.js (v20.x or higher)
- PostgreSQL (v15+ or hosted instance)
- Redis (v7+)
- npm or yarn

### Setup Steps

1. **Clone the Repository:**

   ```bash
   git clone [https://github.com/your-username/housing-management-system.git](https://github.com/your-username/housing-management-system.git)
   cd housing-management-system
   ```

2. **Install Dependencies:**

   ```bash
   npm ci
   ```

3. **Database Migration & Client Generation:**

   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. **Seed Database (Optional):**

   ```bash
   npx prisma db seed
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:5000`.

---

## Running with Docker

Orchestrate the entire application stack (Node.js API, PostgreSQL, and Redis) with health dependencies using Docker Compose:

```bash
# Build and start all containers in detached mode
docker compose up --build -d

# Inspect running container health status
docker compose ps

# Follow container logs
docker compose logs -f api

# Stop all containers and preserve database volumes
docker compose down
```

---

## API Reference

### 1. Authentication & Session Management (`/api/v1/auth`)

| Method | Endpoint           | Access        | Description                                               |
| :----- | :----------------- | :------------ | :-------------------------------------------------------- |
| `POST` | `/register`        | Public        | Register a new `TENANT` or `OWNER` account                |
| `POST` | `/login`           | Public        | Authenticate user, issue access token and refresh cookie  |
| `POST` | `/refresh-token`   | Public        | Rotate refresh token with reuse-detection guards          |
| `POST` | `/forgot-password` | Public        | Send 6-digit OTP to user email via Redis (5 min TTL)      |
| `POST` | `/reset-password`  | Public        | Validate OTP, update password, revoke all active sessions |
| `POST` | `/logout`          | Authenticated | Revoke active refresh token and clear session cookies     |

### 2. User Profiles (`/api/v1/users`)

| Method  | Endpoint     | Access        | Description                                              |
| :------ | :----------- | :------------ | :------------------------------------------------------- |
| `GET`   | `/me`        | Authenticated | Fetch authenticated user profile & roommate preferences  |
| `PATCH` | `/me`        | Authenticated | Update user name, contact number, or bio                 |
| `PATCH` | `/me/avatar` | Authenticated | Upload profile avatar; deletes previous Cloudinary asset |

### 3. Units & Rooms Inventory (`/api/v1`)

| Method   | Endpoint            | Access           | Description                                            |
| :------- | :------------------ | :--------------- | :----------------------------------------------------- |
| `GET`    | `/units`            | Public           | List units with embedded rooms, photos, and pagination |
| `POST`   | `/units`            | `OWNER`, `ADMIN` | Create a new property unit                             |
| `PATCH`  | `/units/:id`        | `OWNER`, `ADMIN` | Update unit pricing, specifications, or rules          |
| `DELETE` | `/units/:id`        | `OWNER`, `ADMIN` | Soft delete unit (`deletedAt` timestamp update)        |
| `PATCH`  | `/units/:id/images` | `OWNER`, `ADMIN` | Upload gallery image array to Cloudinary               |
| `GET`    | `/rooms`            | Public           | Filter available rooms by budget, size, and amenities  |
| `PATCH`  | `/rooms/:id/images` | `OWNER`, `ADMIN` | Upload room-specific gallery images                    |

### 4. Payments & Financials (`/api/v1/payments`)

| Method | Endpoint           | Access                 | Description                                            |
| :----- | :----------------- | :--------------------- | :----------------------------------------------------- |
| `POST` | `/create-intent`   | `TENANT`               | Create Stripe PaymentIntent for rent or deposit        |
| `POST` | `/webhook`         | Public (Stripe Signed) | Raw-body webhook reconciliation for completed payments |
| `GET`  | `/my-transactions` | Authenticated          | Retrieve personal payment transaction history          |

### 5. Diagnostics (`/api/v1`)

| Method | Endpoint  | Access | Description                                           |
| :----- | :-------- | :----- | :---------------------------------------------------- |
| `GET`  | `/health` | Public | Ping checks for PostgreSQL, Redis, memory, and uptime |

---

## Error Handling & Response Standards

All endpoints return a uniform response envelope:

### Success Response (`2xx`)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User profile retrieved successfully",
  "data": {
    "id": "c1f728c3-4c9f-4eb8-b649-62323a677334",
    "name": "Jane Tenant",
    "email": "jane.tenant@example.com",
    "role": "TENANT",
    "status": "ACTIVE"
  }
}
```

### Error Response (`4xx` / `5xx`)

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error",
  "errorSources": [
    {
      "path": "email",
      "message": "Invalid email address format"
    }
  ],
  "stack": null
}
```

---

## Scripts

| Command                     | Description                                                     |
| :-------------------------- | :-------------------------------------------------------------- |
| `npm run dev`               | Start development server with file watching (`tsx` / `nodemon`) |
| `npm run build`             | Compile TypeScript source into `/dist`                          |
| `npm start`                 | Run compiled JavaScript server in production mode               |
| `npm run lint`              | Run ESLint across codebase                                      |
| `npx prisma studio`         | Open local visual database browser interface                    |
| `npx prisma migrate dev`    | Generate and apply migration to local database                  |
| `npx prisma migrate deploy` | Apply pending database migrations in production                 |

---

## License

This project is licensed under the [MIT License](LICENSE).
