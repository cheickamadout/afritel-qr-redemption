# AFRITEL QR Redemption Dashboard — Phase 1

Internal dashboard for AFRITEL staff to generate, manage, and track batches of QR codes linked to Mobimatter data plans.

## Phase 1 Status

✅ **Complete** — Foundation & Admin Dashboard

- PostgreSQL schema with proper indexes
- Next.js + Vercel + Neon setup
- Clerk authentication
- Admin dashboard: batch creation, listing, export (PDF + CSV)
- Mobimatter API integration (products endpoint)
- Redemption code generation (UUID v4 → Base62)
- QR code generation (data URIs)
- Batch detail view with stats

## Setup

### Prerequisites

- Node.js 18+
- Neon PostgreSQL account
- Clerk authentication account
- Mobimatter API sandbox access

### Installation

```bash
npm install
```

### Environment Setup

1. Copy `.env.example` to `.env.local`
2. Fill in the following:
   - `DATABASE_URL` — Neon PostgreSQL connection string
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk public key
   - `CLERK_SECRET_KEY` — Clerk secret key
   - `MOBIMATTER_API_KEY` — Mobimatter sandbox API key
   - `MOBIMATTER_MERCHANT_ID` — Your merchant ID
   - `MOBIMATTER_API_BASE_URL` — Sandbox: `https://api-sandbox.mobimatter.com/mobimatter/api/v2/`

### Database Setup

```bash
psql $DATABASE_URL -f schema.sql
```

### Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000`

- Admin: `/admin/dashboard` (requires Clerk sign-in)
- Home: `/` (links to admin and demo)

## API Endpoints (Phase 1)

### Admin (Protected by Clerk)

- `POST /api/admin/batches` — Create batch with redemption codes
- `GET /api/admin/batches` — List batches for current user
- `GET /api/admin/batches/:id` — Get batch detail + codes + stats
- `GET /api/admin/batches/:id/export?format=csv|pdf` — Export batch

### Public

- (Phase 2) `GET /r/:code` — Public redemption page
- (Phase 2) `POST /api/public/redeem` — KYC submission + Mobimatter order

## Key Decisions

1. **Single Next.js App** — Admin dashboard and public redemption share auth context, secrets, database
2. **UUID v4 → Base62** — Cryptographically random, compact, URL-safe redemption codes
3. **Batch Cap at 5,000** — Synchronous generation, no async queue needed
4. **Both Export Formats** — PDF for printing (grid of QRs), CSV for records
5. **Clerk Auth** — Simple, scalable admin authentication

## Next: Phase 2

- Public redemption page (`/r/[code]`)
- KYC form (full name, phone, email, consent checkbox)
- Mobimatter order creation and completion
- Real eSIM QR and LPA delivery
- Platform detection (iOS tap-to-install, Android, desktop QR)
- Concurrent redemption prevention
- Error handling (402, 429, 455, 400)
