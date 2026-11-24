# SayMyName: Multi-Agent Coordination Board

This document serves as the shared coordination and synchronization registry for multiple agents operating concurrently on the `SayMyName.in` repository, following **Document 09 (Antigravity Implementation and Agent Operating Guide)**.

---

## 1. Active Agent Registry & Domain Ownership

| Agent Identifier / Session | Primary Role / Domain | Assigned Packages / Folders | Status | Last Active |
| :--- | :--- | :--- | :--- | :--- |
| **Agent A** (`d128fe15-1432-4ba6-b32c-ec8285fc2dcc`) | Backend, Database, Realtime & Contracts | `packages/database`, `packages/contracts`, `services/api`, `services/worker`, `docker-compose.yml` | Scaffolding Database & API | 2026-11-24 |
| **Agent B** (`b91879ad-f61a-4733-82e8-165326036643`) | Frontend, UI/UX & Client Applications | `packages/design-tokens`, `packages/validation`, `apps/web`, `apps/mobile` | Active / Ready for Scaffolding | 2026-11-24 |

> [!IMPORTANT]
> **Boundary Rule (Doc 09 §6.1)**: Two agents must never edit the same files or perform conflicting migrations concurrently. Check the **File Locks** table below before modifying any shared package or root file.

---

## 2. Active File & Module Locks

| Locked Resource / File | Owning Agent | Purpose | Lock Acquired At | Status |
| :--- | :--- | :--- | :--- | :--- |
| `packages/database/*` | Agent A | Prisma schema with 7 logical namespaces (Doc 06) | 2026-11-24 14:03 IST | **LOCKED (Agent A)** |
| `packages/contracts/*` | Agent A | Shared API DTOs, WebSocket events, and models | 2026-11-24 14:03 IST | **LOCKED (Agent A)** |
| `services/api/*` | Agent A | NestJS modular monolith skeleton | 2026-11-24 14:03 IST | **LOCKED (Agent A)** |
| `packages/design-tokens/*` | Agent B | Tokens per Doc 03 (Newsreader, DM Sans, warm editorial palette) | 2026-11-24 14:03 IST | **RESERVED (Agent B)** |
| `packages/validation/*` | Agent B | Shared validation schemas | 2026-11-24 14:03 IST | **RESERVED (Agent B)** |
| `apps/web/*` | Agent B | Next.js App Router frontend application | 2026-11-24 14:03 IST | **RESERVED (Agent B)** |
| `apps/mobile/*` | Agent B | React Native / Expo mobile application | 2026-11-24 14:03 IST | **RESERVED (Agent B)** |
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
