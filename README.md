# Inventory Management System

A production-ready, multi-tenant inventory management system.

## Tech Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (access + refresh tokens) + Argon2 password hashing
- **Validation**: Zod

### Frontend
- **Framework**: React + TypeScript (Vite)
- **Styling**: Tailwind CSS
- **State**: Zustand (auth + tenant)
- **Data fetching**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Routing**: React Router DOM

## Features

- **Multi-tenant** — each user can own/belong to multiple organizations
- **Multi-branch/warehouse** — stock tracked per branch
- **User-first** — register/login → then create your organization
- **Product catalog** — products with multiple variants (name, SKU, price, cost)
- **Category management** — hierarchical categories
- **Inventory management** — stock levels, stock adjustments, movement history
- **Sales orders** — full lifecycle (draft → confirmed → processing → shipped → delivered), refunds
- **Audit log** — every action logged for accountability
- **Dashboard** — stats, charts, low-stock alerts, recent orders

## Quick Start

### Using Docker Compose (recommended)

```bash
# Clone and start everything
docker compose up -d

# Run DB migrations (first time)
docker compose exec backend npm run migrate
```

Frontend (Nginx): http://localhost:5173  
Backend API (via Nginx): http://localhost:5173/api  
MinIO API: http://localhost:9000  
MinIO Console: http://localhost:9001

### Deploying on Vercel

This repository includes a root `vercel.json` that deploys:
- `frontend` as a static Vite app
- `backend` as a serverless function at `/api/*`

Set these Vercel environment variables:
- Backend: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`
- Frontend (optional): `VITE_API_URL` (defaults to `/api` in Vercel)

For local development, keep `frontend/.env` as:
```bash
VITE_API_URL=http://localhost:3001
```

### Manual Setup

**Backend**
```bash
cd backend
cp .env.example .env      # fill in your DATABASE_URL and JWT secrets
npm install
npm run migrate           # run DB migrations
npm run dev               # start dev server on :3001
```

**Frontend**
```bash
cd frontend
cp .env.example .env      # set VITE_API_URL=http://localhost:3001
npm install
npm run dev               # start dev server on :5173
```

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema/        # Drizzle schema definitions
│   │   │   └── migrate.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts        # JWT verify + tenant context
│   │   │   └── auditLog.ts    # Auto audit logging
│   │   └── routes/
│   │       ├── auth.ts        # register / login / refresh
│   │       ├── tenants.ts     # CRUD tenants + members
│   │       ├── branches.ts    # CRUD branches/warehouses
│   │       ├── categories.ts  # CRUD categories
│   │       ├── products.ts    # CRUD products + variants
│   │       ├── inventory.ts   # Stock levels + adjustments + movements
│   │       ├── salesOrders.ts # Create/manage orders + refunds
│   │       ├── dashboard.ts   # Stats + charts data
│   │       └── auditLogs.ts   # View audit trail
│   └── drizzle.config.ts
│
└── frontend/
    └── src/
        ├── api/client.ts       # Axios with auth interceptors
        ├── stores/             # Zustand stores (auth, tenant)
        ├── components/ui/      # Reusable UI (Button, Input, Card, Modal…)
        ├── layouts/AppLayout   # Sidebar + main layout
        └── pages/
            ├── auth/           # Login, Register, Setup (tenant creation)
            ├── dashboard/      # Stats + charts
            ├── products/       # Product catalog + variants
            ├── categories/     # Category management
            ├── inventory/      # Stock levels + adjustments
            ├── orders/         # Sales orders + refunds
            └── audit/          # Audit log
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| POST | /api/auth/refresh | Refresh access token |
| GET/POST | /api/tenants | List / create tenant |
| GET/PATCH/DELETE | /api/tenants/:id | Get / update / delete tenant |
| GET/POST | /api/tenants/:id/branches | List / create branch |
| GET/POST | /api/tenants/:id/categories | List / create category |
| GET/POST | /api/tenants/:id/products | List / create product |
| GET/POST | /api/tenants/:id/products/:pid/variants | List / create variant |
| GET | /api/tenants/:id/inventory | Stock levels |
| POST | /api/tenants/:id/inventory/adjust | Adjust stock |
| GET | /api/tenants/:id/inventory/movements | Movement history |
| GET/POST | /api/tenants/:id/sales-orders | List / create order |
| PATCH | /api/tenants/:id/sales-orders/:oid | Update order status |
| POST | /api/tenants/:id/sales-orders/:oid/refund | Process refund |
| GET | /api/tenants/:id/audit-logs | View audit log |
| GET | /api/tenants/:id/dashboard/stats | Dashboard stats |
