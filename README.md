# RetailBrain Backend

Production backend for **RetailBrain**, a machine-learning-powered retail
analytics and prediction platform. This API is built to work with the
existing RetailBrain React frontend through its `src/services/api.js`
abstraction layer — no other frontend file needed to change.

---

## 1. Project Overview

RetailBrain lets a user register, log in, submit customer/order data, get an
ML purchase-likelihood prediction, record what actually happened, and see
whether the prediction was correct — plus dashboard and analytics views over
their own prediction history. The ML model behind predictions is currently
**mocked** behind a single, swappable service (`mlService.js`) so a real
trained model can be dropped in later without touching any controller,
route, or the frontend.

## 2. Tech Stack

- Node.js (ES Modules) + Express.js
- MongoDB + Mongoose
- JWT authentication via **httpOnly session cookie** (see §8)
- bcryptjs for password hashing
- Zod for request validation
- helmet, cors, express-rate-limit, express-mongo-sanitize for hardening
- morgan for request logging
- Jest + Supertest + mongodb-memory-server for tests

## 3. Folder Structure

```
backend/
├── src/
│   ├── config/          # env.js, db.js
│   ├── controllers/     # thin HTTP handlers
│   ├── middleware/       # auth, error handling, validation, rate limiting
│   ├── models/           # Mongoose schemas (User, Prediction, ModelMetrics)
│   ├── routes/           # Express routers
│   ├── services/         # business logic (auth, predictions, analytics, ML)
│   ├── validators/       # Zod schemas
│   ├── scripts/seed.js   # dev-only seed script
│   ├── app.js             # Express app assembly
│   └── server.js          # entrypoint
├── tests/                 # Jest + Supertest
├── .env.example
└── package.json
```

## 4. Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `PORT` | Port the API listens on (default `5000`) |
| `NODE_ENV` | `development` \| `production` \| `test` |
| `MONGODB_URI` | Mongo connection string, e.g. `mongodb://127.0.0.1:27017/RetailBrain` or an Atlas SRV URI |
| `JWT_SECRET` | Long random string — never commit a real value |
| `JWT_EXPIRES_IN` | JWT lifetime, e.g. `7d` |
| `FRONTEND_URL` | Origin allowed by CORS, e.g. `http://localhost:5173` |
| `CROSS_SITE_COOKIES` | `true` in production if frontend/backend are on different domains (sets `SameSite=None; Secure` on the auth cookie) |
| `DEMO_USER_PASSWORD` | Seed material for demo-account password hashing (not a real login credential) |

## 5. MongoDB Setup

**Local:** install MongoDB Community Server, run `mongod`, and set
`MONGODB_URI=mongodb://127.0.0.1:27017/RetailBrain`.

**Atlas:** create a free cluster, add a database user, allow your IP, and use
the provided SRV connection string as `MONGODB_URI`.

Indexes are created automatically by Mongoose from the schema definitions on
first connection (`email` unique on Users; `userId`, `createdAt`, `status`,
and compound `userId+createdAt` / `userId+status` on Predictions).

## 6. How to Run Locally

```bash
cd backend
cp .env.example .env        # then fill in MONGODB_URI and JWT_SECRET
npm install
npm run dev                 # nodemon, http://localhost:5000
npm run seed                # optional: creates a demo user + 30 sample predictions
```

The seed script prints the demo login credentials it creates (fake, local
only) and refuses to run if `NODE_ENV=production`.

## 7. API Endpoints

All responses use the envelope `{ success, data }` on success or
`{ success: false, error: { code, message, details? } }` on failure.
Protected routes require the `rb_token` session cookie (see §8).

### Auth (`/api/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | – | `{name,email,password}` → creates user, sets session cookie |
| POST | `/login` | – | `{email,password}` → sets session cookie |
| POST | `/demo` | – | Creates a fresh throwaway demo user + 12 sample predictions, sets session cookie |
| POST | `/logout` | – | Clears the session cookie |
| GET | `/me` | ✅ | Returns the current user |

### Predictions (`/api/predictions`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | ✅ | `{inputData}` → runs mock ML, stores and returns the prediction |
| GET | `/?search=&status=&sortBy=&page=&pageSize=` | ✅ | Paginated history, scoped to the caller |
| GET | `/:id` | ✅ | Single prediction (404 if not owned by caller) |
| PATCH | `/:id/outcome` | ✅ | `{actualOutcome}` → server computes `status` (Correct/Incorrect) |

### Analytics (`/api/analytics`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard` | ✅ | Stats + time series + recent predictions for the caller |
| GET | `/` | ✅ | Full analytics payload (charts + global model metrics) |

### Profile (`/api/users`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/me` | ✅ | Profile + `{totalPredictions, accuracy}` |
| PATCH | `/me` | ✅ | `{name?, email?}` — allow-listed fields only |
| PATCH | `/me/password` | ✅ | `{currentPassword, newPassword}` |

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | `{success, message, database: "connected"\|"disconnected"}` |

## 8. Authentication Flow

The React frontend never stores or attaches a bearer token (confirmed by
inspecting `AuthContext` and `api.js`), so this backend uses an **httpOnly
session cookie** as the actual auth mechanism:

1. `POST /auth/register` / `/login` / `/demo` verifies credentials, signs a
   JWT (`sub` = user id), and sets it as an httpOnly, `SameSite=Lax` (or
   `None` cross-site in production) cookie named `rb_token`.
2. Every subsequent request the frontend makes uses `fetch(..., {credentials:
   'include'})`, so the browser attaches the cookie automatically.
3. `requireAuth` middleware reads and verifies that cookie on protected
   routes and attaches `req.user.id` — **never** a client-supplied `userId`.
4. `POST /auth/logout` clears the cookie. Because JWTs are stateless, this
   invalidates the *client's* ability to present the cookie but does not
   revoke the token itself before expiry — no blacklist is implemented. If
   server-side revocation becomes a requirement, add a token-blacklist
   collection (or move to short-lived tokens + refresh tokens).

The `token` string is still returned in the auth response bodies for API
contract completeness (useful for non-browser API clients), but the shipped
frontend ignores it entirely.

## 9. Database Schemas

**User**
```
{ _id, name, email (unique, lowercase), passwordHash (never returned),
  isDemo, lastLoginAt, createdAt, updatedAt }
```

**Prediction**
```
{ _id, userId (ref User), customer,
  inputData (flexible object — validated at the API boundary against the
             16 fields the frontend's PREDICTION_FORM_CONFIG defines, but
             stored schemalessly so new ML features don't require a
             migration),
  prediction: 'Likely to Purchase' | 'Unlikely to Purchase',
  confidence: Number (52-97 from the mock model),
  actualOutcome: 'Purchased' | 'Did Not Purchase' | 'Not Known Yet',
  status: 'Pending' | 'Correct' | 'Incorrect'  (always server-computed),
  createdAt, updatedAt, evaluatedAt }
```

**ModelMetrics** — a cached, global (cross-user) aggregate:
```
{ scope: 'global', total, correct, incorrect, pending, evaluated,
  accuracy, updatedAt }
```
Predictions is always the source of truth; `recalculateModelMetrics()` in
`analyticsService.js` can rebuild this document at any time.

## 10. Frontend Connection

Only `src/services/api.js` in the frontend changed (plus one call-site fix
in `Profile.jsx` — see the frontend's own README/PR notes). Set
`VITE_API_URL` in the frontend's `.env` to this backend's `/api` base
(default `http://localhost:5000/api`). No React page or component logic
changed.

## 11. ML Integration Architecture

```
predictionController → predictionService → mlService → (model)
```
`mlService.predict(inputData)` currently returns a deterministic, clearly
mock-labeled `{prediction, confidence, isMock: true}` result (mirroring the
frontend's own former placeholder formula, for behavioral consistency during
the transition). To integrate the real trained model later, **replace only
the body of `mlService.predict`** — everything upstream (API contract,
controllers, routes, the frontend) is unaffected.

## 12. Testing

```bash
npm test
```

Covers: registration/duplicate-email/login/invalid-login/`/me`,
unauthenticated vs. authenticated access, cross-user isolation (a user can
never read or list another user's predictions), prediction create/retrieve/
history/outcome-evaluation, dashboard/analytics correctness, profile update
with mass-assignment protection, and password-change with/without correct
current password.

> **Note:** the test suite uses `mongodb-memory-server`, which downloads a
> MongoDB binary on first run. If you're in a network-restricted environment
> without access to `fastdl.mongodb.org`, either run tests somewhere with
> internet access, point `MONGODB_URI` at a real local/Atlas instance and
> adapt `tests/setup.js` to skip spinning up the in-memory server, or install
> MongoDB via your OS package manager and reference that binary via
> `mongodb-memory-server`'s `SystemBinary` option.

## 13. Production Deployment

1. Set `NODE_ENV=production`, a strong `JWT_SECRET`, and the real
   `MONGODB_URI` (e.g. Atlas) as environment variables on your host.
2. Set `FRONTEND_URL` to your deployed frontend's exact origin (no
   wildcards — `credentials: true` CORS forbids `origin: "*"`).
3. If frontend and backend are on different domains, set
   `CROSS_SITE_COOKIES=true` so the auth cookie is issued with
   `SameSite=None; Secure` (requires HTTPS on both sides).
4. Run behind a process manager (pm2, systemd) or a container platform;
   `app.set('trust proxy', 1)` is already configured for a reverse proxy /
   load balancer.
5. `npm run seed` is dev-only and refuses to run when `NODE_ENV=production`.
6. Point the frontend's `VITE_API_URL` at the deployed backend's `/api` base
   and rebuild.
