# 🏠 DARY

**DARY** is a student housing marketplace backend that connects tenants, property owners, and admins through a role-based platform for listing, discovering, and requesting rental properties — built around how student housing is actually rented: **per bed, not per unit**.

Instead of an in-house payment and negotiation flow, DARY routes bookings through admins who coordinate directly with tenants and owners via **WhatsApp**, while everything else (listings, approvals, bidding, reviews, support) runs through a full REST API with real-time notifications.

---

## ✨ Key Features

- 🔐 **Authentication** — JWT (access + refresh, httpOnly cookies), OTP email verification, password reset, Google Sign-In
- 🛡️ **Full RBAC** — dynamic Roles & Permissions (`Role`, `Permission`, `UserRole`, `RolePermission`), managed entirely through the API — no hardcoded role checks
- 🏘️ **Property Listings** — multi-step submission wizard, per-bed room configurations (`PropertyRoom`), categorized photos (kitchen/bathroom/living room), admin review workflow (Pending → Approved/Rejected)
- 🛏️ **Room-Based Renting** — each property can have multiple room configurations, each with its own price, bed count, and availability
- 📅 **Bookings** — tenants request a specific room/bed count; admins pick up requests and coordinate via a pre-filled WhatsApp link
- 💰 **Bidding** — tenants can propose an alternative price on a property or specific room
- 📄 **Digital Contracts** *(future-ready)* — contract lifecycle modeled (Draft → Signed by Tenant → Signed by Owner → Active), not yet wired to a signing flow
- ⭐ **Reviews** — post-booking ratings for both the property and the owner, moderated before publishing
- 🚩 **Reports** — users can report properties or other users (spam, fraud, etc.), triaged by priority
- 🎫 **Support Tickets** — threaded conversations between users and assigned admins
- 🔔 **Real-Time Notifications** — Socket.io for instant admin alerts (new listings, bookings, reports, tickets), backed by a persistent, retry-aware notification log
- 📊 **Admin Dashboard API** — stats + filterable/sortable/paginated lists for properties, users, bookings, and reports
- ☁️ **Image Uploads** — Cloudinary, with automatic `webp` conversion and folder organization
- 🌍 **i18n Ready** — all service-layer errors and messages go through a translation function (`t()`)

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | PostgreSQL |
| ORM | Prisma (`@prisma/adapter-pg` driver adapter) |
| Auth | JWT (`jsonwebtoken`), `bcrypt` |
| Real-time | Socket.io |
| File Storage | Cloudinary |
| Email | Nodemailer |
| Validation | Manual + `AppError` |
| Module System | ES Modules (`import` / `export`) |

---

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
│
├── src/
│   ├── config/
│   │   └── prisma/
│   │       └── connect.db.js      # Prisma client (singleton) + connection lifecycle
│   │
│   ├── core/
│   │   ├── cloudinary/            # Image upload/delete service
│   │   ├── email/                 # Branded email templates + sender
│   │   ├── i18n/                  # Translations
│   │   └── middleware/
│   │       └── error/
│   │           └── AppError.js    # Custom operational error class
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js     # JWT verification
│   │   ├── permission.middleware.js  # RBAC guards (requirePermission / requireRole)
│   │   └── upload.middleware.js   # Multer (memory storage)
│   │
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── utils/
│   │   ├── rbac.js                # Role/permission lookups
│   │   ├── jwt.js                 # Token generation & verification
│   │   ├── setAuthCookies.js
│   │   └── api-features.js        # Reusable filter/sort/paginate query builder
│   │
│   ├── app.js
│   └── server.js
│
├── .env.example
└── package.json
```

---

## 🗄️ Database Overview

Core entities and how they relate:

- **User** — auth + profile (`Profile` is a separate 1:1 model for personal details)
- **Role / Permission / UserRole / RolePermission** — full RBAC, no hardcoded roles
- **Property / PropertyRoom / PropertyImage** — a property has many rooms, each independently priced and booked by the bed
- **Booking** — tenant requests a specific room; tracked through `PENDING → CONTACTED → CLOSED/CANCELLED`
- **Bid** — alternative price offers, separate from the direct booking flow
- **Contract** — future-ready digital contract lifecycle, tied 1:1 to a Booking
- **Review** — tied 1:1 to a completed Booking, rates both property and owner
- **Report** — polymorphic target (either a Property or a User)
- **SupportTicket / TicketMessage / Attachment** — threaded support conversations
- **Notification** — persisted + delivered via Socket.io, with delivery/retry tracking
- **AuditLog** — tracks sensitive admin actions

Status fields use **dedicated enums per entity** (e.g. `PropertyStatus`, `BookingStatus`, `TicketStatus`) rather than a shared status table, favoring query performance over runtime-configurable statuses.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- A Cloudinary account (for image uploads)
- Gmail (or any SMTP) credentials for transactional emails

### 1. Clone & Install

```bash
git clone <repo-url>
cd backend
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dary

# JWT
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email
APP_EMAIL_ADDRESS=
APP_EMAIL_PASSWORD=

# Initial super admin (used by prisma/seed.js)
SUPER_ADMIN_EMAIL=admin@dary.dev
SUPER_ADMIN_PASSWORD=ChangeMe123!
```

### 3. Set Up the Database

```bash
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

The seed script creates the base roles (`tenant`, `owner`, `admin`, `super_admin`), default permissions, links them to the `admin` role, and creates the first super admin account.

### 4. Run the Server

```bash
npm run dev     # development (nodemon)
npm start       # production
```

Server runs at `http://localhost:5000` by default.

---

## 🔑 Roles & Permissions

| Role | Assigned | Scope |
|---|---|---|
| `tenant` | Self-registration | Browse, book, bid, review, report, open tickets |
| `owner` | Self-registration | List & manage own properties, view own bookings |
| `admin` | By a super admin | Whatever permissions they've been granted (e.g. `review_properties`, `manage_bookings`) |
| `super_admin` | Seeded manually | Full access — always bypasses permission checks |

Permissions are **data, not code** — a super admin can create new permissions and assign them to roles entirely through the API, with no redeploy required.

---

## 📡 API Modules

| Module | Base Route | Description |
|---|---|---|
| Auth | `/auth` | Register, login, refresh, logout, OTP, password reset, Google login |
| Profile | `/profile` | Personal profile (self + limited public view) |
| Roles | `/roles` | RBAC role management *(super admin)* |
| Permissions | `/permissions` | RBAC permission management *(super admin)* |
| Properties | `/properties` | Public search, creation, owner review |
| Bookings | `/bookings` | Tenant requests, admin handling, status transitions |
| Bids | `/bids` | Alternative price offers |
| Reports | `/reports` | User-submitted reports on properties/users |
| Tickets | `/tickets` | Support ticket threads |
| Notifications | `/notifications` | In-app notification feed |
| Dashboard | `/dashboard` | Admin stats + filtered lists (properties, users, bookings, reports) |

> Full request/response contracts are documented inline in each controller.

---

## 🗺️ Roadmap

- [ ] Wire up the digital contract signing flow (`Contract` model is ready)
- [ ] In-app payments & owner payouts (`Wallet` model is ready)
- [ ] Push notifications via `DeviceToken` (mobile app)
- [ ] Elasticsearch/Redis-backed search for scale

---

## 📄 License

ISC — see `package.json`.
