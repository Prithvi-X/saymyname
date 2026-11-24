# ADR-017: Verification Adapter Boundaries & No Government ID Collection

- **Status:** Accepted
- **Date:** 2026-11-24
- **Decision owner:** Product + Security + Human Project Owner (`D-P2-01`)
- **Reviewers:** Privacy/Legal, Application Security
- **Related tasks / documents:** Document 01 (§3.1, §3.5), Document 04 (`D04-01`, `D04-02`), Document 05 (§9.2, §17 `ADR-07`), Document 06 (§5.2–5.4), `docs/decisions/DECISION_REGISTER.md`

## Context
Existing `IdentityService.checkAge()` and `verifyStudent()` immediately mark accounts `ageStatus = 'approved'`, `studentStatus = 'approved'`, `discoveryEligible = true`, and `accountStatus = 'active'` from self-declared DOB and `{ programmeFamily, studentRollNo }`. A read-only review of the remote Supabase DB confirmed 16 active accounts had `verifiedBy = 'automated_rules_engine'` with zero `VerificationCase` rows, and 9 rejected under-18 accounts still got `studentStatus = 'approved'`.

## Decision drivers
- Prevent self-declared DOB or self-declared student claims from unlocking adult dating capabilities (`AGENTS.md`, Doc 01 §3.5).
- Keep provider integration decoupled behind clean TypeScript adapter interfaces (`Doc 05 §9.2`).
- Strictly minimize sensitive data collection — explicitly prohibit collecting government ID documents until legal/privacy handling is approved.

## Options considered
1. **Separate Provider Adapters + `pending_verification`/`in_review` Review Gate + No Gov ID Collection:** Create `AgeVerificationAdapter` and `StudentEnrolmentAdapter` plus `VerificationCase`/`VerificationEvidenceRef` workflow. Only an authorised reviewer endpoint (`ReviewerGuard`) or verified external provider callback transitions status to `approved`. Never collect gov ID documents.
2. **Self-declared immediate approval:** Rejected; violates Product Constitution and Phase 2 security requirements.

## Decision
Adopt Option 1 (`Accepted`).
1. **Immediate Security Fix:** Remove automatic approval in `NODE_ENV === 'production'` and revoke unguarded self-service promotion in `checkAge()` and `verifyStudent()`. Reject student verification attempts for under-18 rejected accounts (`ForbiddenException`).
2. **Separate Adapters:**
   - `AgeVerificationAdapter`: verifies adulthood (`>= 18`) through provider attestation or approved assurance flow without treating raw self-declared DOB as proof. Never stores raw DOB in public profiles.
   - `StudentEnrolmentAdapter`: validates approved Phase 1 non-campus BS programme families and academic level (`foundation`, `diploma`, `degree`) via non-gov-ID institutional/enrolment verification workflow (`VerificationCase` + private R2 `VerificationEvidenceRef` when non-gov-ID student enrolment proof is provided).
3. **Strict Evidence Governance:**
   - **Zero Government ID Collection:** Do not prompt for, accept, or upload Aadhaar, PAN, Passport, Driving Licence, or other government ID documents in Phase 2 UI/API.
   - Private R2 prefix (`verification-evidence/...`), server-validated MIME/size + SHA-256 checksum, `retention_until` expiry metadata, private access only via short-lived authorised fetch for reviewers.
4. **No Production Auto-Verify:** Non-production QA helper (`SYNTHETIC_VERIFICATION_AUTO_APPROVE`) MUST throw/remain hard-disabled when `NODE_ENV === 'production'`. Default runtime posture moves submitted cases to `pending_verification` / `in_review`.

## Consequences and trade-offs
- Newly registered accounts reach `VERIFICATION_PENDING` until reviewed via the least-privilege Reviewer API (`POST /api/v1/verification-cases/:id/decision`) or approved provider adapter callback.
- End-to-end automated tests can verify both the real `pending_verification` gate AND the explicit Reviewer approval transition without bypassing the domain rule.

## Security, privacy, safety and operations impact
Closes privilege escalation from self-declared age/enrolment and prevents unapproved storage of sensitive Indian identity documents.

## Migration / rollback / compatibility
Schema expands `account_eligibility`, `verification_cases`, and `verification_evidence_refs` additively. Existing `VerificationCase`-less active accounts on shared DB remain untouched pending separate operator decision.

## Evidence and review date
- Target Verification: `ELG-001..007`, negative tests asserting self-declared DOB/student submission cannot set `discoveryEligible = true`, and production-mode unit tests asserting zero auto-approval.
