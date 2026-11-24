# ADR-019: Strict Central Institutional BS Email Allowlist & Domain Boundary Check

- **Status:** Accepted
- **Date:** 2026-11-24
- **Decision owner:** Product + Engineering (`D-P2-03`)
- **Reviewers:** Application Security
- **Related tasks / documents:** Document 01 (§3.1, `D-01`), Document 05 (§9.2), `docs/decisions/DECISION_REGISTER.md`

## Context
`IdentityService.validateIitmEmail()` accepted `.iitm.ac.in` and `@iitm.ac.in`, allowing faculty or general on-campus IIT Madras accounts outside the four approved non-campus BS programmes, and `services/api/test/identity.test.ts:39` encoded `faculty@iitm.ac.in -> true`. Meanwhile `apps/web` used inconsistent local suffix checks (`cleanEmail.endsWith('iitm.ac.in')`).

## Decision drivers
- Enforce Document 01 §3.1 strict restriction to IIT Madras non-campus BS programmes.
- Eliminate duplicated, divergent email domain logic across frontend and backend.
- Ensure exact hostname boundary parsing so lookalike domains cannot match via naive `.endsWith()`.

## Options considered
1. **Single central allowlist + RFC-safe parser in `@saymyname/validation`:** Allow only exact approved non-campus BS study domains (`study.iitm.ac.in`, `ds.study.iitm.ac.in`, `es.study.iitm.ac.in`, plus explicitly registered BS programme study subdomains under `study.iitm.ac.in`); reject general `@iitm.ac.in` campus/faculty domains; separate email validation cleanly from student enrolment verification.
2. Keep `.iitm.ac.in` wildcard suffix matching.

## Decision
Adopt Option 1 (`Accepted`).
- Define `APPROVED_IITM_BS_EMAIL_DOMAINS` (`['study.iitm.ac.in', 'ds.study.iitm.ac.in', 'es.study.iitm.ac.in']` plus configurable allowlisted BS subdomains) and `isApprovedIitmBsEmail(email)` in `@saymyname/validation`.
- Validate exact syntax: single `@`, non-empty valid local-part, exact hostname equality against the allowlist (rejecting `user@evilstudy.iitm.ac.in`, `@iitm.ac.in`, `@smail.iitm.ac.in`, whitespace, control chars).
- Update `IdentityService.validateIitmEmail()` and frontend forms to consume this single helper.
- Update `services/api/test/identity.test.ts` to assert `faculty@iitm.ac.in -> false` and `evilstudy.iitm.ac.in -> false` (`D-P2-03` approved test expectation change).
- Explicitly separate domain validation from `studentStatus`: email domain passes **only** email step eligibility, never student verification.

## Consequences and trade-offs
- On-campus `@iitm.ac.in` users are rejected with clear guidance linking to the Eligibility Guide (`Phase 2.3`). Future approved BS subdomains require updating the central constant in `@saymyname/validation`.

## Security, privacy, safety and operations impact
Prevents privilege creep to out-of-scope campus domains and suffix-spoofing bypasses.

## Migration / rollback / compatibility
Read-only audit confirmed 0 existing accounts use non-BS domains (`26/26` use `@*.study.iitm.ac.in`).

## Evidence and review date
- Target Verification: Unit tests in `@saymyname/validation` and `services/api/test/identity.test.ts` covering valid BS study domains, `@iitm.ac.in`, `@smail.iitm.ac.in`, `badstudy.iitm.ac.in`, and malformed emails.
