# Better Auth Migration Plan

Replace Firebase Auth with Better Auth — a self-hosted, TypeScript-first auth library that runs on the existing Express API server and stores sessions in Postgres via Drizzle.

## Why

Firebase Auth works fine today. This migration is optional and only worth doing if:
- You want zero external auth dependencies
- You need auth features Firebase doesn't support
- You want to fully decommission the Firebase project

## Current State

- **Frontend:** Firebase Auth with Google Sign-In (popup flow)
- **API:** Firebase Admin SDK verifies ID tokens in `api/src/middleware/auth.ts`
- **User ID:** Firebase UID `7zJGLcWhxAQFAQ1ObovUHveZQL93` used as `user_id` across all Postgres tables
- **API keys:** SHA-256 hashed keys in `api_keys` table, used by MCP server — unaffected by this migration

## Architecture Decision: Bearer Tokens

The frontend (`tempo.designbyjohnwayne.com`) and API (`tempo-api-production.up.railway.app`) are on different domains. Third-party cookies are blocked by modern browsers, so cookie-based sessions won't work. Better Auth's **Bearer plugin** is the correct approach: after sign-in, the client stores a session token and sends it as `Authorization: Bearer <token>` — exactly like the current Firebase ID token flow.

## UX Change

Sign-in switches from a popup window to a full-page redirect through Google. This is better for mobile and PWA contexts.

---

## Phase 1: API — Install and Configure Better Auth

### 1.1 Install

```bash
cd api
npm install better-auth
```

### 1.2 Create `api/src/lib/auth.ts`

```typescript
import { betterAuth } from "better-auth"
import { bearer } from "better-auth/plugins"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "../db/index.js"

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  database: drizzleAdapter(db, { provider: "pg" }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      prompt: "select_account",
    },
  },
  plugins: [bearer()],
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://tempo.designbyjohnwayne.com",
  ],
  user: {
    additionalFields: {
      firebaseUid: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
})
```

### 1.3 Generate database tables

```bash
npx auth@latest generate   # generates Drizzle schema for user, session, account, verification tables
npx drizzle-kit generate
npx drizzle-kit push
```

### 1.4 Mount in `api/src/index.ts`

Add **before** `express.json()` (Better Auth handles its own body parsing):

```typescript
import { toNodeHandler } from "better-auth/node"
import { auth } from "./lib/auth.js"

app.all("/api/auth/*", toNodeHandler(auth))
```

Remove `firebase-admin` import and `admin.initializeApp()`.

### 1.5 Environment variables

```env
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=https://tempo-api-production.up.railway.app
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

---

## Phase 2: API — Rewrite Auth Middleware

Replace `api/src/middleware/auth.ts`. The API key path stays unchanged. The Bearer token path switches from Firebase Admin to Better Auth:

```typescript
import { auth } from "../lib/auth.js"

async function verifyBearerToken(req: Request): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: req.headers,
  })
  if (!session) return null
  return (session.user as any).firebaseUid || session.user.id
}
```

The `firebaseUid` fallback ensures existing data continues to resolve correctly.

---

## Phase 3: Frontend — Swap Auth

### 3.1 Install

```bash
npm install better-auth
```

### 3.2 Create `src/lib/auth-client.ts`

```typescript
import { createAuthClient } from "better-auth/react"

const API_BASE = import.meta.env.VITE_API_URL || "https://tempo-api-production.up.railway.app"

export const authClient = createAuthClient({
  baseURL: API_BASE,
  basePath: "/api/auth",
})
```

### 3.3 Rewrite `src/context/AuthContext.tsx`

- Replace `onAuthStateChanged` with `authClient.useSession()`
- Replace `signInWithPopup` with `authClient.signIn.social({ provider: "google" })`
- Replace `signOut` with `authClient.signOut()`
- Store Bearer token from sign-in response in `localStorage`

```typescript
const signIn = async () => {
  await authClient.signIn.social({
    provider: "google",
  }, {
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get("set-auth-token")
      if (token) localStorage.setItem("tempo_auth_token", token)
    },
  })
}
```

### 3.4 Update `src/lib/api.ts`

Replace Firebase token retrieval:

```typescript
async function getAuthHeaders(): Promise<HeadersInit> {
  const token = localStorage.getItem("tempo_auth_token")
  if (!token) throw new Error("Not authenticated")
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}
```

### 3.5 Update `src/lib/anthropic.ts`

Same change — read token from `localStorage` instead of Firebase.

### 3.6 Rename user properties across the frontend

| Firebase          | Better Auth | Files affected |
| ----------------- | ----------- | -------------- |
| `user.uid`        | `user.id`   | All 8 hooks, query keys |
| `user.displayName`| `user.name` | Settings.tsx, Sidebar.tsx, MobileMenu.tsx |
| `user.photoURL`   | `user.image`| Settings.tsx, Sidebar.tsx, MobileMenu.tsx |
| `user.email`      | `user.email`| No change |

### 3.7 Remove Firebase

- Delete `src/lib/firebase.ts`
- Remove `firebase` from `package.json`
- Remove `firebase-admin` from `api/package.json`
- Remove all `VITE_FIREBASE_*` env vars

---

## Phase 4: Data Migration

### 4.1 Link Firebase UID to Better Auth user

After deploying Phases 1-3, sign in once with Google. This creates a Better Auth user record. Then run a one-time script:

1. Find the Better Auth user by email
2. Set `firebaseUid` to `7zJGLcWhxAQFAQ1ObovUHveZQL93` on that user record
3. Verify the middleware returns the correct `userId`

### 4.2 (Optional, later) Migrate all user_id columns

Once everything is stable, update all tables to use the Better Auth user ID directly:

```sql
UPDATE todos SET user_id = '<better-auth-id>' WHERE user_id = '7zJGLcWhxAQFAQ1ObovUHveZQL93';
-- Repeat for: notes, habits, calendar_events, conversations,
--             user_preferences, today_sets, weekly_reviews, api_keys
```

Then remove the `firebaseUid` compatibility shim from the middleware.

---

## Phase 5: Google Cloud Console

1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Authorized redirect URIs:
   - `https://tempo-api-production.up.railway.app/api/auth/callback/google`
   - `http://localhost:3001/api/auth/callback/google` (local dev)
4. Copy Client ID and Client Secret to API environment variables

---

## Deployment Sequence

1. **Set up Google OAuth credentials** (Phase 5)
2. **Deploy API** with Better Auth mounted + dual-auth middleware (accepts both Firebase and Better Auth tokens)
3. **Deploy frontend** with Better Auth client
4. **Sign in** with the new flow, verify everything works
5. **Run migration script** to link Firebase UID (Phase 4.1)
6. **Remove dual-auth**, remove Firebase dependencies
7. **Optionally** migrate all `user_id` values to Better Auth IDs (Phase 4.2)

## Rollback Plan

- Keep `firebase` and `firebase-admin` in `package.json` until fully verified
- The dual-auth middleware allows both token types during transition
- New Better Auth tables are additive — existing tables are untouched
- To rollback: revert middleware and AuthContext to Firebase, ignore the new tables
