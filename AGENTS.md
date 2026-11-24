# SayMyName repository instructions

You are working on SayMyName.in, an independent dating-first product for verified adults currently enrolled in the four approved IIT Madras non-campus BS programme families. Phase 1 is 18+ and IITM-only. Do not imply IIT Madras owns, endorses or operates the product.

## Read the source documents

Before a non-trivial change, use `docs/product/SPECIFICATION_INDEX.md` and read the relevant approved Documents 01-09. The domain document owns its subject. Document 08 governs delivery order and gates. Document 09 governs agent behaviour. The current code is evidence of implementation, not proof of an approved requirement.

## Mandatory operating loop

1. Inspect the repository, Git state, existing conventions and available test commands before editing.
2. Link the task to a requirement/feature/test ID and identify its acceptance criteria.
3. Use `/plan` for cross-file, ambiguous, architecture, database, security, provider or other high-risk work. Wait for human review where required.
4. Implement the smallest coherent vertical slice. Preserve unrelated changes.
5. Test the happy path and applicable negative, failure, retry, permission and cross-platform paths.
6. Review the complete diff, migrations, generated files and dependency changes.
7. Update traceability, decisions and relevant documentation.
8. Report exact commands and results, skipped checks, changed files, residual risks and blockers.

## Non-negotiable product rules

- Never permit an under-18 or unverified account to access dating capabilities.
- Phase 1 includes only the four approved IITM non-campus BS programme families. Do not add institutions or programme families without an approved change.
- A Like is not permission to message. Private messaging requires an active mutual match and no block/restriction.
- Calls, games and virtual dates require explicit invitations and acceptance.
- Relationship Mode requires two independent affirmative actions. Either partner can leave independently. No surveillance or coercive monitoring.
- No unsolicited stranger DMs, anonymous chat roulette, public exact-location tracking or public social feed in Phase 1.
- No default audio-call recording. Never use private messages/calls for advertising or model training without separate informed, revocable opt-in.
- Enforce privacy and object ownership on the server, not only in the UI.

## Engineering rules

- Follow Documents 05 and 06. Do not introduce an unapproved framework, provider, ORM, cloud region or external service.
- Keep the agreed modular-monolith boundaries. A module must not write another module's private tables directly.
- PostgreSQL is the source of truth. Redis is not a substitute for durable records.
- Do not expose credentials, tokens, verification documents or private content in browser bundles, logs, screenshots, fixtures or reports.
- Use synthetic test data. Keep secrets outside Git and use approved secret management.
- Use migrations for schema changes. Never reset, drop or rewrite shared/production data to clear a blocker.
- Do not weaken tests, authorisation, privacy or security controls to make a build pass.

## Human approval boundaries

Ask before changing eligibility, scope, consent, verification, identity/auth/session architecture, E2EE, retention/deletion, data region, provider contracts, external spend, destructive migrations, production data access, production deployments or release flags. Antigravity cannot approve its own phase gate or production release.

## Honest completion

Do not claim a test passed unless it was executed and passed. Distinguish PASS, FAIL, NOT RUN and BLOCKED. If evidence is missing, mark the work partial or blocked. Never silently add or remove scope.
