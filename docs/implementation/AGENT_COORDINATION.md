# SayMyName: Multi-Agent Coordination Board

This document serves as the shared coordination and synchronization registry for multiple agents operating concurrently on the `SayMyName.in` repository, following **Document 09 (Antigravity Implementation and Agent Operating Guide)**.

---

## 1. Active Agent Registry & Domain Ownership

| Agent Identifier / Session | Primary Role / Domain | Assigned Packages / Folders | Status | Last Active |
| :--- | :--- | :--- | :--- | :--- |
| **Agent A** (`d128fe15-1432-4ba6-b32c-ec8285fc2dcc`) | Backend, Database, Realtime & Contracts | `packages/database`, `packages/contracts`, `services/api`, `services/worker`, `docker-compose.yml` | Scaffolding Database & API | 2026-11-24 |
| **Agent B** (`b91879ad-f61a-4733-82e8-165326036643`) | Frontend, UI/UX & Client Applications | `packages/design-tokens`, `packages/validation`, `apps/web`, `apps/mobile` | Scaffolding Complete / Ready for Review | 2026-11-24 14:08 IST |

> [!IMPORTANT]
> **Boundary Rule (Doc 09 §6.1)**: Two agents must never edit the same files or perform conflicting migrations concurrently. Check the **File Locks** table below before modifying any shared package or root file.

---

## 2. Active File & Module Locks

| Locked Resource / File | Owning Agent | Purpose | Lock Acquired At | Status |
| :--- | :--- | :--- | :--- | :--- |
| `packages/database/*` | Agent A | Prisma schema with 7 logical namespaces (Doc 06) | 2026-11-24 14:03 IST | **COMPLETED (Agent A)** |
| `packages/contracts/*` | Agent A | Shared API DTOs, WebSocket events, and models | 2026-11-24 14:03 IST | **COMPLETED (Agent A)** |
| `services/api/*` | Agent A | NestJS modular monolith skeleton with /health & Swagger | 2026-11-24 14:03 IST | **COMPLETED (Agent A)** |
| `packages/design-tokens/*` | Agent B | Tokens per Doc 03 (Newsreader, DM Sans, warm editorial palette) | 2026-11-24 14:03 IST | **COMPLETED (Agent B)** |
| `packages/validation/*` | Agent B | Shared validation schemas | 2026-11-24 14:03 IST | **COMPLETED (Agent B)** |
| `services/api/src/modules/{together,realtime}/*` | Agent A | Phase 4 Real-time calling (LiveKit), games & socket gateway | 2026-11-24 14:53 IST | **LOCKED (Phase 4 - Agent A)** |
| `apps/web/app/(app)/chats/*` (WebRTC Call & Game Modals) | Agent B | Phase 4 audio/video WebRTC calling UI & game components | 2026-11-24 14:53 IST | **LOCKED (Phase 4 - Agent B)** |
| `apps/mobile/*` | Agent B | React Native / Expo mobile views matching Document 02 & 03 | 2026-11-24 14:03 IST | **STANDBY (Agent B)** |
| Root `package.json`, `package-lock.json` | — | Scaffolding complete; open for additive workspace scripts | 2026-11-24 14:03 IST | **RELEASED (Clean)** |

---

## 3. Communication & Handoff Log

### [2026-11-24 14:03 IST] Agent A $\rightarrow$ Agent B:
- **Root Monorepo Scaffolding Complete**:
  - `package.json` configured with npm workspaces: `apps/*`, `services/*`, `packages/*`.
  - `.gitignore`, `tsconfig.base.json`, `.prettierrc`, `docker-compose.yml`, and `.env.example` committed.
- **Agent A Next Focus**:
  - Scaffolding `packages/database` with Prisma 6+ and all 7 logical schemas per Document 06 (`identity`, `profiles`, `dating`, `messaging`, `together`, `safety`, `platform`).
  - Scaffolding `packages/contracts` with core TypeScript entity types, REST DTOs, and WebSocket event payloads.
  - Scaffolding `services/api` (NestJS).
- **Go-Ahead for Agent B**:
  - The root workspace is ready! Agent B can safely pull the commit and initialize `packages/design-tokens`, `packages/validation`, `apps/web`, and `apps/mobile`.

### [2026-11-24 14:09 IST] Agent B $\rightarrow$ Agent A:
- **Frontend Scaffolding Complete**:
  - `packages/design-tokens`: Full design system tokens (colors, Newsreader/DM Sans typography, 1-20 spacing scale, radii, elevation, motion, `tokens.css`) compiled with zero errors.
  - `packages/validation`: Runtime validation schemas for 18+ age checks, 4 approved IITM BS programme codes, profile fields, text message limits, and safety report reasons compiled with zero errors.
  - `apps/web`: Next.js App Router application with Warm Editorial Minimalism design system, responsive navigation, eligibility guide, safety commitments, and core application navigation shells (`/discover`, `/likes`, `/matches`, `/chats`, `/profile`).
  - `apps/mobile`: React Native + Expo application structure with 5-tab primary navigation bar (`Discover | Likes | Matches | Chats | Profile`) adhering to Document 02 & 03.
- **Commit**: `feat(client): scaffold design-tokens, validation, web Next.js and mobile Expo apps`.

### [2026-11-24 14:14 IST] Agent A $\rightarrow$ Agent B:
- **Phase 1 Technical Foundation Complete**:
  - `packages/database`: Prisma Client v6.19.3 generated with all 7 logical schemas (`identity`, `profiles`, `dating`, `messaging`, `together`, `safety`, `platform`).
  - `packages/contracts`: Full TypeScript contracts, DTOs, and WebSocket event envelopes compiled.
  - `services/api`: NestJS API application compiled with global validation, Swagger docs (`/docs`), and health check (`/api/v1/health`).
  - All monorepo packages (`contracts`, `database`, `design-tokens`, `validation`, `api`, `web`) compile together cleanly with zero errors via `npm run build`.
- **Commit**: `feat(backend): complete database schemas, contracts and NestJS API service`.
- **Next Step (Phase 2)**:
  - Transitioning to **Phase 2: Identity, Eligibility & Trust Foundation** (`identity` module, authentication, 18+ age gate, student verification workflow, and session management).

### [2026-11-24 14:21 IST] Agent A $\rightarrow$ Agent B:
- **Phase 2 Identity, Auth & Eligibility Backend Complete**:
  - `POST /api/v1/identity/register`: Enforces `@*.study.iitm.ac.in` domain validation.
  - `POST /api/v1/identity/verify-otp`: Validates 6-digit OTP, creates account and initial eligibility state.
  - `POST /api/v1/identity/age-check`: Validates DOB, strictly rejects `< 18` with `403 Forbidden` per Doc 01 §3.5.
  - `POST /api/v1/identity/verify-student`: Enforces the 4 approved IITM BS programme tracks, unlocks dating capabilities (`discoveryEligible: true`).
  - `POST /api/v1/identity/refresh` & `POST /api/v1/identity/logout`: Session rotation & revocation.
  - `GET /api/v1/identity/me`: Current authenticated user context.
  - `JwtAuthGuard` & `EligibilityGuard`: Server-side default-deny guards.
  - Unit tests: 5/5 domain tests passed (`npm run --workspace=@saymyname/api test`).
  - Full build: `npm run build` passed across monorepo.
- **Ready for Client Wiring**:
  - Agent B can wire client auth/onboarding forms in `apps/web` and `apps/mobile` directly to `http://localhost:4000/api/v1/identity/*`.

### [2026-11-24 14:53 IST] Agent B & Agent A Synchronisation:
- **Phase 3 Core Discovery & Matchmaking (P0 Dating Loop) Fully Completed & Verified**:
  - **Backend (Agent A)**:
    - `profiles` module: full profile management, bio, prompts, interests, cohort tag.
    - `dating` module: candidate queue, like, pass, mutual match detection with lexicographical ordering (`userLowId < userHighId` per Doc 06 §6.3).
    - `messaging` module: bilateral mutual-match conversations, message persistence, 1000 character validation.
    - `safety` module: immediate universal block (`POST /api/v1/safety/block`) and confidential report (`POST /api/v1/safety/report`) with match termination.
    - Unit tests: 9/9 passed (`identity.test.ts` & `dating.test.ts`).
  - **Frontend (Agent B)**:
    - Interactive candidate discovery card deck (`/discover`) with editorial layout, prompt answer cards, cohort badges, and like/pass actions.
    - Mutual match celebration modal with direct transition to chat.
    - Active matches list (`/matches`) with "Like is not permission to message" invariant banner.
    - Bilateral 1-on-1 chat interface (`/chats`) with message thread, character counter, delivery state markers, and universal block/report actions.
    - Profile editor & privacy controls (`/profile`) with "Pause Discovery" and 18+ student badges.
    - Likes received queue (`/likes`) with privacy callout.
  - **Local Hosting Verified**:
    - Web Client: `http://localhost:3000` (all 9 routes responding 200 OK via `scripts/test-web-routes.mjs`).
    - API Server: `http://localhost:4000` (all 7 identity & eligibility checks passing via `scripts/test-identity-flow.mjs`, Swagger docs at `/docs`).
  - **Commit**: `a1e096e` (`feat(phase3): complete P0 dating loop, candidate discovery, bilateral chat and safety controls`).
- **Advancing to Phase 4**: Together Experience (LiveKit WebRTC calling, word games, and bilateral Relationship Mode).




