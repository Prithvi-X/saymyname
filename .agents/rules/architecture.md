---
trigger: model_decision
description: Apply when modifying application structure, frontend/backend modules, providers, infrastructure, background jobs, WebSockets, WebRTC or architectural boundaries.
---

# Architecture constraints

Read Document 05 and the relevant Document 06 contracts before changing system structure.

- Baseline: TypeScript monorepo with Next.js web, React Native + Expo mobile, NestJS API and worker, shared contracts/validation/design tokens/domain types.
- Use modular monolith boundaries first. API and worker may be separate deployment processes from one backend codebase.
- PostgreSQL is the durable source of truth; Redis is for approved cache/temporary/live state.
- Controllers and gateways remain thin. Domain state transitions stay in the owning module.
- A module does not write another module's private tables or import its private infrastructure.
- Use explicit provider adapters. Unapproved vendors, cloud regions, ORM choices and external services remain open until an ADR is approved.
- Do not break API/event contracts silently. Use additive compatibility or an approved coordinated version transition.
- Preserve platform-specific accessibility, navigation, secure storage, permissions and audio behaviour.
