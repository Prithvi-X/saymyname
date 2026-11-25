# SAYMYNAME.IN
# PHASE 3.1: SECURITY CONTAINMENT & IMPLEMENTATION AUDIT REPORT

**Audit Date**: 2026-11-25  
**Audit Scope**: Credential Containment, Build Pipeline Integrity, Prisma & Database Configuration, Next.js BFF Architecture, Private R2 Media Uploads, and Phase 3.1 Profile & Dating Preferences Specification Reconciliations.  
**Governing Documents**: Documents 01–10, `AGENTS.md`, `.agents/rules/`  
**Status**: AUDIT COMPLETE — AWAITING HUMAN REVIEW (NO PRODUCTION DEPLOYS OR CONFIGURATION CHANGES EXECUTED)

---

## 1. Credential Exposure Containment Recommendations

### 1.1 Containment Assessment & Incident Response
In accordance with Document 05 §8.1 and the repository security invariants (`.agents/rules/security-privacy.md`), all credentials and tokens previously output in plain-text logs or conversation transcripts must be treated as **fully compromised**.

### 1.2 Required Provider Credential Rotation Protocol (Human Operator Action Items)
The human operator must directly execute the following credential rotations in the respective provider management consoles. The agent has **not** accessed or modified any production service settings.

1. **Supabase PostgreSQL Database**:
   - Navigate to *Supabase Dashboard $\rightarrow$ Project Settings $\rightarrow$ Database*.
   - Click **Reset Database Password**.
   - Generate a new cryptographically strong password.
   - Update the connection string in the local isolated development environment only.

2. **JWT Signing Keys**:
   - Generate new 256-bit entropy random hex secrets for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` using `openssl rand -hex 32`.
   - Rotate the secrets to instantly invalidate all previously issued tokens across all environments.

3. **Resend Transactional Email API Key**:
   - Navigate to *Resend Console $\rightarrow$ API Keys*.
   - Revoke the existing API key immediately.
   - Generate a new restricted API key for transactional email dispatch.
   - Confirm sender domain verification for `saymyname.in` with DNS SPF, DKIM, and DMARC records before live dispatch.

4. **Cloudflare R2 Media Storage Credentials**:
   - Navigate to *Cloudflare Dashboard $\rightarrow$ R2 $\rightarrow$ Manage R2 API Tokens*.
   - Delete/Revoke the active token.
   - Create a new R2 API token with scoped permissions restricted specifically to `Object Read & Write` on the `saymyname-media` private bucket.

5. **LiveKit Cloud WebRTC Server Credentials**:
   - Navigate to *LiveKit Cloud Console $\rightarrow$ Project Settings $\rightarrow$ Keys*.
   - Revoke the current API Key and Secret.
   - Generate a new API Key/Secret pair for real-time room token generation.

### 1.3 Confidentiality Invariants
- Under no circumstances will existing or newly generated secret values be echoed into terminal outputs, markdown files, PR descriptions, or chat messages.
- The repository only tracks whether a required key is **PRESENT** or **MISSING**.

---

## 2. Environment Variable Audit & Mapping (Names Only)

| Variable Name | Consuming Application | Context | Required | Target Environment | Local Status | Architectural Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PORT` | `services/api` | Server-side | Yes | Local / Render | PRESENT | Backend HTTP listening port (defaults to 10000 on Render, 4000 local). Binds to `0.0.0.0`. |
| `NODE_ENV` | `services/api`, `apps/web` | Server-side | Yes | All | PRESENT | Runtime mode (`development`, `test`, `production`). Triggers production security guards. |
| `DATABASE_URL` | `services/api` | Server-side | Yes | All | PRESENT | PostgreSQL connection string for Prisma runtime queries (uses port 6543 pooler with `pgbouncer=true`). |
| `DIRECT_URL` | `services/api`, `packages/database` | Server-side | Recommended | Supabase / Migrations | MISSING | Direct connection string (port 5432) bypassing PgBouncer; required for Prisma migrations and schema DDL. |
| `JWT_ACCESS_SECRET` | `services/api` | Server-side | Yes | All | PRESENT | Secret key used to sign and verify short-lived access JWTs (15m expiry). |
| `JWT_REFRESH_SECRET`| `services/api` | Server-side | Yes | All | PRESENT | Secret key used to sign and verify long-lived refresh JWTs (7d expiry). |
| `RESEND_API_KEY` | `services/api` | Server-side | Yes | All (live email) | PRESENT | API token for Resend transactional email dispatch. |
| `EMAIL_FROM` | `services/api` | Server-side | Yes | All | PRESENT | Verified sender mailbox address (e.g., `SayMyName <auth@saymyname.in>`). |
| `R2_ACCOUNT_ID` | `services/api` | Server-side | Yes | All | PRESENT | Cloudflare account identifier for private R2 object storage. |
| `R2_BUCKET_NAME` | `services/api` | Server-side | Yes | All | PRESENT | Private S3-compatible bucket name (`saymyname-media`). |
| `R2_ACCESS_KEY_ID` | `services/api` | Server-side | Yes | All | PRESENT | S3-compatible access key for presigning and signed GET requests. |
| `R2_SECRET_ACCESS_KEY`| `services/api`| Server-side | Yes | All | PRESENT | S3-compatible secret access key. |
| `R2_ENDPOINT` | `services/api` | Server-side | Optional | All | PRESENT | S3 API endpoint URL (`https://<account_id>.r2.cloudflarestorage.com`). |
| `LIVEKIT_URL` | `services/api` | Server-side | Yes | Real-time calling | PRESENT | WebRTC signaling websocket endpoint (`wss://...livekit.cloud`). |
| `LIVEKIT_API_KEY` | `services/api` | Server-side | Yes | Real-time calling | PRESENT | LiveKit project access key. |
| `LIVEKIT_API_SECRET`| `services/api` | Server-side | Yes | Real-time calling | PRESENT | LiveKit secret used for server-side room token minting. |
| `NEXT_PUBLIC_LIVEKIT_URL` | `apps/web` | Browser-visible| Yes | Real-time calling | PRESENT | Public WebRTC signaling WebSocket endpoint for browser audio connection. |
| `API_BACKEND_URL` | `apps/web` | Server-side | Yes | Vercel / Web | PRESENT | Internal backend URL used exclusively by Next.js Server BFF to proxy `/api/bff/v1/*` requests. |
| `WEB_APP_URL` | `services/api` | Server-side | Yes | Render / API | PRESENT | Web origin for CORS validation and password-reset links. |

### Critical Security Finding on `NEXT_PUBLIC_API_ORIGIN`:
- In the initial frontend prototype, `NEXT_PUBLIC_API_ORIGIN` was referenced in `apps/web/lib/server-bff.ts` as a fallback.
- **Audit Finding**: In Next.js, any variable prefixed with `NEXT_PUBLIC_` is inlined into client-side JavaScript bundles sent to all browsers. Because SayMyName employs an architectural Next.js BFF where the browser communicates **only** with same-origin routes (`/api/auth/*` and `/api/bff/v1/*`), exposing the backend origin to the browser is an unnecessary data leak and could encourage bypass of the BFF.
- **Remediation**: `apps/web/lib/server-bff.ts` has been refactored to read exclusively from `process.env.API_BACKEND_URL` (server-side only). `NEXT_PUBLIC_API_ORIGIN` is fully deprecated and removed.

---

## 3. Phase 3.1 Specification Inconsistencies & Reconciliations

Reviewing `phase3-1-profile-plan.md` against Documents 01, 04, and 06 revealed several discrepancies that have now been resolved:

| Specification Item | Initial Plan / Drift | Approved Specification (Docs 01, 04, 06) | Reconciled Status |
| :--- | :--- | :--- | :--- |
| **Academic Programme Universe** | Contained inadvertent duplicate entry for Aeronautics | Exactly four approved IIT Madras non-campus BS degree families | **Corrected**: Exactly 4 approved programmes enforced. |
| **Maximum Interests** | Unspecified / flexible | Up to 10 interests selected strictly from curated catalogue (Document 06 §5.8). No arbitrary user strings. | **Reconciled**: Backend & frontend enforce max 10. |
| **Maximum Prompts** | Ambiguous prompt counts | Maximum 3 active conversation prompts; answer max 250 chars; prompt label max 160 chars (Doc 06 §5.9). | **Reconciled**: Enforced at DTO and service layer. |
| **Maximum Photographs** | 6 slots | Maximum 6 photos per profile; unique ordering (index 0 = primary) (Doc 06 §5.7). | **Reconciled**: Enforced in DTO and DB transactions. |
| **Minimum Photos for Live** | Draft allowed 0 photos | Draft saving allows 0 photos; publication to Discover strictly requires $\ge 1$ approved portrait photo (Doc 01 §3.5). | **Reconciled**: Enforced by `publishProfile` gate. |
| **Maximum Photo File Size** | 10 MB | 10 MB (10,485,760 bytes) supported formats: JPEG, PNG, WebP, HEIC (Doc 05 §8.3). | **Reconciled**: Validated in presign and client upload. |
| **Biography Length** | 500 characters | Maximum 500 characters, multiline preserved, sanitized against code/injection (Doc 04 §4). | **Reconciled**: Enforced at frontend counter and DTO `@MaxLength(500)`. |
| **`ageDisplayMode`** | Boolean or unspecified | Enum CHECK: `'hidden'` or `'show_calculated_age'`. Exact date of birth must never be exposed (Doc 06 §5.6). | **Reconciled**: Validated via DTO `@IsIn(['hidden', 'show_calculated_age'])`. |
| **Relationship Intention** | Free text | Controlled taxonomy (e.g. Long-term, Open to explore, Study & date) (Doc 06 §5.6). | **Reconciled**: Controlled values selectable in UI. |
| **Location Visibility** | Unclear granularity | Coarse region only (`locationCity`, `locationState`). Zero live GPS, coordinates, or real-time location (Doc 01 §3.5). | **Reconciled**: No coordinate fields or geolocation permissions. |
| **Dating Preferences** | Partial filters | `minAge` ($\ge 18$), `maxAge` ($\le 65$), `allowedProgrammes` (subset of 4), `maxDistanceKm`, `showInDiscovery`. Private only (Doc 06 §5.10). | **Reconciled**: Dedicated owner endpoints; omitted from all public DTOs. |
| **Publication Requirements** | Client-side check | Authoritative backend validation: 18+ verified + approved BS enrolment + valid display name + $\ge 1$ portrait photo + guidelines consent. | **Reconciled**: Enforced authoritatively by server. |

---

## 4. Corrected Four-Programme Mapping

Phase 1 institutional eligibility is restricted strictly to the following four approved IIT Madras non-campus BS programme families (Document 01 §3.1, Decision `D-01`):

```typescript
export enum ProgrammeFamily {
  DATA_SCIENCE_APPLICATIONS = 'data_science_applications',
  ELECTRONIC_SYSTEMS = 'electronic_systems',
  AERONAUTICS_SPACE = 'aeronautics_space',
  MANAGEMENT_DATA_SCIENCE = 'management_data_science',
}
```

- **Human-Readable Labels**:
  1. `data_science_applications`: **BS in Data Science and Applications**
  2. `electronic_systems`: **BS in Electronic Systems**
  3. `aeronautics_space`: **BS in Aeronautics and Space Technology**
  4. `management_data_science`: **BS in Management and Data Science**

*Any secondary, duplicate, or external entries have been excised from contracts, services, and UI components.*

---

## 5. Root Causes of Previous Build Failures

### Investigation Summary
Three distinct build issues occurred in the previous execution history:

1. **Original Render.com Build Failure (`Cannot find module '@saymyname/contracts'` and `Property 'userBlock' does not exist on type 'PrismaService'`)**:
   - *Error*: Render executed `npm install && npm run build` inside `@saymyname/api`.
   - *Root Cause*: `@saymyname/api` depends on compiled output from monorepo sibling packages (`@saymyname/contracts`, `@saymyname/database`, etc.). On a clean build container, workspace packages had not been built before `tsc` was invoked in `@saymyname/api`. Additionally, `@prisma/client` had not been generated by Prisma.

2. **Windows Local Development Engine DLL Lock (`EPERM: operation not permitted, rename query_engine-windows.dll.node`)**:
   - *Error*: During local prebuild runs on Windows, `prisma generate` failed with an `EPERM` error attempting to rename temporary DLL files.
   - *Root Cause*: A background Node.js process (the previously started local API server process) was actively running on port 4000 and had `query_engine-windows.dll.node` memory-mapped via Windows `LoadLibraryEx`. Windows denies write/rename access to open binaries.

3. **Flawed Workaround in `prebuild.js` and `package.json`**:
   - *What was changed*: The previous agent wrapped `npm run build:packages` in `services/api/scripts/prebuild.js` in a `try...catch` block, and wrapped `prisma generate` in `packages/database/package.json` with a node inline catch script.
   - *Why this was unacceptable*: This suppressed legitimate build failures. If `@saymyname/contracts` or `@saymyname/validation` had actual syntax or type errors, `build:packages` failed, but `prebuild.js` swallowed the error and continued, resulting in confusing downstream compilation failures or masking broken packages.

---

## 6. Prebuild Script & Package Compilation Review

### Corrective Action Taken:
1. **Removed Error Swallowing**:
   - `packages/database/package.json` script restored to standard fail-closed execution:
     ```json
     "build": "prisma generate && tsc"
     ```
   - `services/api/scripts/prebuild.js` restored to throw immediately on dependency build failure:
     ```javascript
     console.log('[prebuild] Building shared workspace packages from monorepo root:', dir);
     execSync('npm run build:packages', { cwd: dir, stdio: 'inherit' });
     ```
2. **Proper Process Management**:
   - Terminated the lingering background dev process holding the Windows engine DLL lock.
   - Re-executed clean `npm run build:packages` and `npm run --workspace=@saymyname/api build`.
   - Result: **Both completed with exit code 0 and zero errors swallowed.**

---

## 7. Database and Prisma Connection Architecture

### 7.1 Architecture Breakdown: Pooled Runtime vs. Direct Migration Connections
- **Runtime Connection (`DATABASE_URL`)**:
  - Consumed by `@prisma/client` at runtime in the NestJS application.
  - Connects to the connection pooler (e.g. Supabase PgBouncer on port `6543`) with `?pgbouncer=true&sslmode=require`.
  - Optimized for high concurrency, short-lived transactional queries, and minimal persistent connection overhead.
- **Direct Connection (`DIRECT_URL`)**:
  - Required for Prisma CLI operations: `prisma migrate dev`, `prisma migrate deploy`, and schema introspection (`prisma db pull`).
  - Connects directly to PostgreSQL on port `5432`.
  - Required because connection poolers in transaction mode do not support session-level PostgreSQL features (such as advisory locks, temporary tables, and prepared statements).

### 7.2 Schema Datasource Recommendation
In `packages/database/prisma/schema.prisma`, when deploying against Supabase, the datasource must declare `directUrl`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
  schemas   = ["identity", "profiles", "dating", "messaging", "together", "safety", "platform"]
}
```

### 7.3 Development Isolation Invariant
- **Rule**: All local development and automated CI testing must remain strictly isolated to the local PostgreSQL (port 5433/5432) and local Redis instance.
- Direct ad-hoc connections to shared remote databases (such as Supabase) during local test execution or schema experimentation are prohibited.

---

## 8. Next.js BFF Architecture Verification

### 8.1 Invariant Verification
SayMyName adheres to Document 05 §6.2 and Decision `ADR-018`:
1. **Zero Browser Tokens**: No JWT access or refresh tokens are ever stored in `localStorage`, `sessionStorage`, or JavaScript-accessible cookies.
2. **HttpOnly Same-Origin Cookies**: Authentication sessions rely on `smn_access_token` and `smn_refresh_token` stored with `HttpOnly; SameSite=Lax; Path=/`.
3. **Double-Submit CSRF Protection**: Every mutating browser request (`POST`, `PUT`, `DELETE`, `PATCH`) must include the `X-SMN-CSRF` header matching the readable `smn_csrf` cookie.
4. **BFF Reverse Proxy**: The browser issues requests exclusively to `/api/bff/v1/[...path]` or `/api/auth/*`. The Next.js Route Handler injects the `Authorization: Bearer <accessToken>` header server-to-server and forwards the request to `API_BACKEND_URL`.

### 8.2 Audit Finding & Fix
- Verified that `apps/web/lib/api.ts` makes all browser calls to relative same-origin paths.
- Verified that `apps/web/lib/server-bff.ts` proxies server-side using `process.env.API_BACKEND_URL`.
- Cleaned up `NEXT_PUBLIC_API_ORIGIN` to ensure internal backend URLs are not bundled into public browser scripts.

---

## 9. Private Cloudflare R2 Photo Upload Security Review

### 9.1 Verification of Security Controls
| Security Requirement | Status | Verification Detail |
| :--- | :--- | :--- |
| **Backend-Generated Object Keys** | **PASS** | Generated in `profiles.service.ts` as `photos/${accountId}/${crypto.randomUUID()}.${ext}`. Client cannot dictate arbitrary keys. |
| **Authenticated Ownership** | **PASS** | `presignPhoto` and `addPhoto` extract `accountId` strictly from the verified JWT payload (`req.user.accountId`). |
| **Private Bucket Enforcement** | **PASS** | Cloudflare R2 bucket `saymyname-media` has public access disabled. No public bucket domain or fallback Unsplash URLs exist. |
| **Narrowly Scoped Presigned PUT** | **PASS** | Presigned URL is restricted to HTTP `PUT`, specific S3 key, specific `ContentType` (MIME), and expires in 300 seconds. |
| **Ownership Validation on Attach** | **PASS** | `addPhoto` validates that `dto.s3Key` starts with `photos/${accountId}/` and rejects path traversal (`..`). |
| **Short-Lived Signed GET URLs** | **PASS** | Profile media is hydrated with signed URLs expiring in 180 seconds. Expired URLs fail closed. |
| **Format & MIME Restrictions** | **PASS** | Restricted to `image/jpeg`, `image/png`, `image/webp`, and `image/heic`. |
| **Cross-User Attachment Denial** | **PASS** | Reordering and primary photo updates check `profileId === profile.id`. A user cannot attach or reorder another member's photo. |

### 9.2 Recommended Additional Hardening (Pre-Production Phase Gate)
1. **HeadObject Verification on Attach**: In `addPhoto`, execute an `s3.send(new HeadObjectCommand(...))` before creating the database row to verify that the file was genuinely uploaded to R2 and its `ContentLength` is within the 10 MB limit.
2. **Server-Side EXIF Stripping**: While the client strips metadata or uploads raw images, a Cloudflare Worker or background image pipeline should re-encode photos to strip all EXIF metadata (GPS tags, camera serials) before serving to peers.

---

## 10. Exact Modified File Inventory

The following files were modified and verified as part of Phase 3.1:

1. `packages/contracts/src/dtos/index.ts`:
   - Added `PublicProfileDto`, `DatingPreferencesDto`, and `PhotoReorderDto`.
2. `services/api/src/modules/profiles/dto/profile.dto.ts`:
   - Added `PhotoReorderDto` with array validation.
3. `services/api/src/modules/profiles/profiles.service.ts`:
   - Added `getPreferences(accountId)`: owner-only private preferences.
   - Added `updatePreferences(accountId, dto)`: validated constraints (`minAge >= 18`, `minAge <= maxAge`, `maxAge <= 65`, 4 approved programmes).
   - Added `reorderPhotos(accountId, photoIds)`: strict ownership check and order indexing.
   - Added `getPreviewProfile(accountId)`: self-preview stripping private preferences and identity tokens.
   - Added `getPublicProfile(requesterAccountId, targetProfileId)`: peer profile retrieval enforcing publication and mutual unblocked state.
4. `services/api/src/modules/profiles/profiles.controller.ts`:
   - Added endpoints:
     - `GET /api/v1/profiles/me/preferences`
     - `PUT /api/v1/profiles/me/photos/reorder`
     - `GET /api/v1/profiles/me/preview`
     - `GET /api/v1/profiles/:id/public`
5. `apps/web/lib/server-bff.ts`:
   - Cleaned up `getBackendBaseUrl()` to read server-side `process.env.API_BACKEND_URL` without browser-leaking `NEXT_PUBLIC_` fallbacks.
6. `apps/web/lib/api.ts`:
   - Added client methods: `reorderPhotos`, `getPreferences`, `updatePreferences`, `getProfilePreview`, `getPublicProfile`.
7. `apps/web/app/(app)/profile/page.tsx`:
   - Production profile management interface adhering to Document 10 "The Interval" Dark Cinematic aesthetic.
   - Fixed unused imports, cleaned up `Button` component variant typings (`secondary`), and wired tabbed profile controls.
8. `packages/database/package.json` & `services/api/scripts/prebuild.js`:
   - Restored fail-closed, clean build scripts with zero error-swallowing.

---

## 11. Test and Clean Build Results

### 11.1 Package Compilation
```bash
npm run build:packages
```
- `@saymyname/contracts`: `tsc` $\rightarrow$ **PASS** (Exit Code 0)
- `@saymyname/database`: `prisma generate && tsc` $\rightarrow$ **PASS** (Exit Code 0, Prisma Client v6.19.3 generated in 792ms)
- `@saymyname/design-tokens`: `tsc` $\rightarrow$ **PASS** (Exit Code 0)
- `@saymyname/validation`: `tsc` $\rightarrow$ **PASS** (Exit Code 0)

### 11.2 Backend API Compilation
```bash
npm run --workspace=@saymyname/api build
```
- `prebuild`: Root `build:packages` $\rightarrow$ **PASS** (Exit Code 0)
- `tsc`: `@saymyname/api` $\rightarrow$ **PASS** (Exit Code 0, Zero errors)

### 11.3 Frontend Web Compilation
```bash
npm run --workspace=@saymyname/web build
```
- `next build`:
  - Compiled successfully in 8.9s.
  - Linting and type validity check $\rightarrow$ **PASS** (Zero errors).
  - Static page generation: **30/30 pages prerendered successfully**.
  - Exit Code 0.

### 11.4 Backend Domain Test Suite
```bash
npm run --workspace=@saymyname/api test
```
- Test Suites: **6 passed, 6 total**
- Tests: **32 passed, 32 total (0 failed, 0 skipped)**
- Duration: 10.02s

---

## 12. Remaining Blockers

1. **Credential Rotation Execution**:
   - Compulsory human rotation of Supabase, JWT, Resend, R2, and LiveKit credentials in external provider dashboards before staging/production usage.
2. **Sender Domain DNS Verification**:
   - `auth@saymyname.in` must complete SPF, DKIM, and DMARC verification in Resend before real emails can be delivered to students.
3. **Phase Gate Sign-Off**:
   - Human review and approval of this security and build audit report before progressing to Phase 3.2 (Discover Feed & Matching Algorithm).

---

## 13. Human Approvals Required

In accordance with Document 08 and `AGENTS.md`, the following actions require explicit human operator approval and have **not** been executed automatically:

1. **Production Deployment**: Deploying the updated codebase to Render.com or Vercel.
2. **Production Settings Modification**: Altering environment variables in Render or Vercel dashboards.
3. **Database Migrations on Remote Infrastructure**: Executing DDL or schema migrations on Supabase.
4. **Advancement to Phase 3.2**: Beginning work on candidate discovery scoring, recommendation pipelines, or reciprocal match loops.

---

**Report Prepared By**: Antigravity Multi-disciplinary Engineering Team  
**Review Status**: **READY FOR HUMAN OPERATOR INSPECTION**
