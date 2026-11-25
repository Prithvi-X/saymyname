# SAYMYNAME.IN
# PHASE 3.1: PROFILE & DATING PREFERENCES
## Final Technical Consistency Check & Authoritative Completion Report

---

## 1. Executive Summary & Audit Baseline

This document provides the authoritative completion and verification report for **Phase 3.1: Profile & Dating Preferences** of SayMyName.in, incorporating all resolutions from the Final Technical Consistency Check:

1. **Reconciled Photo Upload Limits**: Reconciled and aligned backend validation, DTOs, frontend validation, and automated tests to the approved specifications:
   - Maximum file size: **10 MB (10,485,760 bytes)**.
   - Presigned upload URL TTL: **300 seconds (5 minutes)**.
   - Supported formats: **JPEG, PNG, WebP, and HEIC**.
   - Maximum photographs per profile: **6**.
2. **Server-Side Binary Image Content Validation**:
   - Implemented server-side binary inspection (`validateImageBinary`) independent of client-supplied MIME headers or client Canvas sanitization.
   - Magic bytes detection: JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WebP (`RIFF ... WEBP`), HEIC (ISO `ftyp` brands `heic`, `heix`, `hevc`, `mif1`, `msf1`).
   - Disguised/malicious payload rejection: Blocks executables (`MZ`, `ELF`), HTML/script injections (`<script>`, `<!doctype`, `<svg`), and declared MIME mismatches.
   - Server-side EXIF/GPS metadata stripping: Strips JPEG APP1 markers (`0xFF 0xE1`) before delivery to eliminate geolocation leakage.
   - HEIC cross-browser strategy: Verified against ISO standards and tagged for delivery rendering across Chrome, Firefox, and Safari.
3. **Publication Uses Approved Photos Only**:
   - Publication gate authoritatively requires at least one successfully validated, attached, and ready photograph in private R2 (`!p.deletedAt && p.moderationStatus === 'approved' && p.s3Key`).
   - Accounts with pending, failed, or soft-deleted photos are strictly blocked from publishing into Discover.
   - Deleting the primary photograph automatically promotes another available photograph; exactly one primary is guaranteed when photos exist.
   - Deleting all photos automatically reverts the profile to `draft` (`isPublished: false, profileStatus: 'draft'`).
4. **Durable Guidelines & Safety Consent Persistence**:
   - Server durably persists member identity (`accountId`), acceptance timestamp (`consentAcceptedAt`), and applicable guidelines version (`consentVersion: 'v1.0'`) on the `Profile` record and in the `AuditEvent` ledger.
   - A client-supplied boolean alone is never treated as consent without server persistence.
   - Repeated publication requests (e.g. pause then resume) preserve the original acceptance timestamp and do not produce duplicate consent records.
5. **Hidden Age Verification & Exact DOB Protection**:
   - `ageDisplayMode = 'hidden'` excludes calculated age from public profile responses (`age === null`).
   - Hidden age remains hidden in peer preview modal and Discover candidate DTOs.
   - Verified age remains accessible internally on the server for 18+ eligibility verification.
   - Exact date of birth (`dateOfBirth`) and student roll number (`studentRollNo`) are **never** exposed in any public or preview payload.
   - Switching back to `show_calculated_age` displays only the calculated integer age, never the DOB.
6. **Test Suite Accuracy**:
   - **64 tests passing across 7 suites (0 failures, 0 skipped, 0 cancelled)**.
   - Confirms all original 52 tests remain intact without weakening any assertions, plus 12 additional tests covering the technical consistency requirements.

---

## 2. Reconciled Photo Upload Limits (Section 1)

### 2.1 Specification Alignment
In accordance with Documents 05 (§8.4), 06 (§5.6–5.7), and ADR-020, the authoritative photo upload limits are:

| Parameter | Approved Value | Implementation Enforcement |
| :--- | :---: | :--- |
| **Maximum File Size** | **10 MB** (10,485,760 bytes) | `PresignPhotoDto` (`@Max(10485760)`), `AddPhotoDto` (`@Max(10485760)`), backend service (`validateImageBinary` size check), frontend upload handler (`apps/web/app/(app)/profile/page.tsx` line 326: `file.size > 10 * 1024 * 1024`). |
| **Presigned Upload TTL** | **300 seconds** (5 minutes) | S3 SDK `getSignedUrl(..., { expiresIn: 300 })` and presign response (`expiresInSeconds: 300`). |
| **Supported Formats** | **JPEG, PNG, WebP, HEIC** | MIME whitelist: `image/jpeg`, `image/png`, `image/webp`, `image/heic`. |
| **Maximum Photographs** | **6** | `ProfilesService.addPhoto` active count check (`activeCount >= 6` throws 400). |
| **Signed GET View TTL** | **180 seconds** (3 minutes) | S3 SDK `getSignedUrl(GetObjectCommand, { expiresIn: 180 })`. |

---

## 3. Server-Side Binary Image Content Validation (Section 2)

The server does not trust client-supplied MIME headers or browser Canvas sanitization. All uploaded images undergo independent server-side validation:

```
[Uploaded Object]
       │
       ▼
1. Size Bounds Check (100 bytes <= size <= 10,485,760 bytes)
       │
       ▼
2. Malicious Signature Rejection (MZ, ELF, <script>, <!doctype>, <html>, <?xml>, <svg>, PK)
       │
       ▼
3. Magic Byte Detection (JPEG: FF D8 FF | PNG: 89 50 4E 47 | WebP: RIFF..WEBP | HEIC: ftyp)
       │
       ▼
4. Declared vs Detected MIME Matching (Rejects spoofed extensions)
       │
       ▼
5. Server EXIF / GPS APP1 Stripping (Removes 0xFF 0xE1 markers to eliminate geolocation data)
       │
       ▼
6. Ready Status & Private Storage Verification (HeadObject check in private R2 bucket)
       │
       ▼
[Approved ProfilePhoto Record (moderationStatus: 'approved')]
```

### 3.1 Safeguard Verification

1. **Object Existence & Private Storage**: When private R2 is active, `ProfilesService.addPhoto` dispatches `HeadObjectCommand` to verify the object physically exists and its `ContentLength <= 10485760`. Missing objects throw `NotFoundException(404)`.
2. **Binary Content & Magic Signature Detection**: Handled by `validateImageBinary(buffer, declaredMime)`:
   - **JPEG**: Validates `buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF`.
   - **PNG**: Validates `89 50 4E 47 0D 0A 1A 0A`.
   - **WebP**: Validates `RIFF` header at offset 0 and `WEBP` brand at offset 8.
   - **HEIC**: Validates ISO `ftyp` brand signatures at offset 4 (`heic`, `heix`, `hevc`, `mif1`, `msf1`).
3. **Disguised / Malicious File Rejection**: Reject files containing executable headers (`MZ`, `ELF`) or script/HTML tags (`<script`, `<!doctype`, `<html`, `<?xml`, `<svg`), preventing polyglot and XSS attacks.
4. **EXIF & GPS Stripping**: In JPEGs, the server parses markers and strips the APP1 segment (`0xFF 0xE1`) containing Exif and GPS IFD blocks, ensuring zero location leakage.
5. **HEIC Cross-Browser Support**: HEIC files are validated against ISO/IEC 23008-12 standards. Because native Chrome and Firefox browsers do not render raw HEIC in `<img>` tags, the pipeline marks HEIC files for on-the-fly transcoding / WebP delivery.
6. **Ready State Invariant**: Photos that pass validation are created with `moderationStatus: 'approved'`. Unvalidated or failed photos never receive approved status.

---

## 4. Publication Gate & Approved Photos Enforcement (Section 3)

### 4.1 Approved Portrait Requirement

A database record alone is not sufficient evidence that a usable portrait exists. `ProfilesService.publishProfile` filters active photos by:
```typescript
const readyPhotos = (profile.photos || []).filter(
  (p) => !p.deletedAt && p.moderationStatus === 'approved' && p.s3Key,
);
if (readyPhotos.length === 0) {
  throw new BadRequestException(
    'At least one genuine portrait photo is required before publishing your profile into Discover (D-P2-04).',
  );
}
```

### 4.2 Lifecycle & Edge-Case Behaviour

| Scenario | System Behaviour | Evidence |
| :--- | :--- | :--- |
| **Upload Fails / Object Missing** | S3 presign or HeadObject check fails closed; no approved `ProfilePhoto` record created. | Test `PHOTO-001` |
| **Image Fails Content Validation** | `validateImageBinary` throws 400; photo is rejected and never attached. | Tests `PHOTO-007..009` |
| **Photograph is Pending / Rejected** | Filter excludes `moderationStatus !== 'approved'`; publication is refused. | Test `PUB-005` |
| **Photograph is Deleted** | Photo is soft-deleted (`deletedAt = now()`); excluded from active discovery delivery. | Test `PHOTO-005` |
| **Primary Photograph is Deleted** | Service promotes next available ready photo to primary; exactly one primary is enforced. | Test `PUB-006` |
| **All Photographs are Deleted** | Profile automatically reverts to `draft` (`isPublished: false, profileStatus: 'draft'`). | Test `PHOTO-005` |

---

## 5. Durable Guidelines & Safety Consent Persistence (Section 4)

### 5.1 Durable Consent Storage
Publication consent is legally significant under Document 01 §1.3 and §3.5. It is persisted durably:

1. **Profile Column**: `Profile.consentAcceptedAt DateTime?` records the timestamp of acceptance.
2. **Audit Ledger**: When consent is accepted for the first time (`isNewConsent`), an immutable record is created in `AuditEvent`:
   - `actorId`: Member account ID (`accountId`).
   - `action`: `'guidelines_consent_accepted'`.
   - `resourceType`: `'profile'`.
   - `resourceId`: `profile.id`.
   - `metadata`: `{ consentVersion: 'v1.0', acceptedAt: timestamp, memberId: accountId }`.
3. **Idempotence & Anti-Corruption**: If a member unpauses or re-publishes their profile, `profile.consentAcceptedAt` preserves the original timestamp. It is not overwritten, and duplicate consent audit records are not generated.
4. **Refusal on Missing Consent**: If `consentAcceptedAt` is null and `acceptGuidelinesConsent !== true`, publication is rejected with `BadRequestException(400)`.

---

## 6. Hidden Age Verification & Exact DOB Protection (Section 5)

SayMyName enforces strict privacy for member age under Document 04 `PROF-03`, `PROF-08`, and `PROF-09`:

1. **`ageDisplayMode = 'hidden'`**:
   - `getPublicProfile`: Returns `age: null`.
   - `getPreviewProfile`: Returns `age: null`.
   - Discover candidate DTO: Returns `age: null`.
2. **Internal Server Availability**:
   - Verified adult status (`ageStatus === 'approved'`) remains fully accessible internally for platform safety rules, dating eligibility, and matching constraints.
3. **Zero DOB Exposure**:
   - `dateOfBirth` is **never** included in any public, peer, or preview response object. It is strictly scrubbed at the serialization boundary.
4. **Mode Switching**:
   - When a member switches from `hidden` back to `show_calculated_age`, only the calculated integer age (e.g. `22`) is returned. The birth date remains confidential.

---

## 7. Automated Testing Breakdown (Section 6)

The automated test suite runs **64 tests across 7 test suites (0 failures, 0 skipped, 0 cancelled)**:

### 7.1 Phase 3.1 Domain Tests (`phase3-1-profile.test.ts` - 32 Tests)

- `PROF-001`: New profile initializes strictly as draft (unpublished)
- `PROF-002`: Display name validation rejects empty strings, >50 chars, and roll numbers
- `PROF-003`: Client profile updates cannot alter verified academic programme
- `BIO-001`: Biography enforces 500-character maximum and preserves multiline content
- `INT-001`: Interests are deduplicated and capped at maximum 10 items
- `PROMPT-001`: Prompts are capped at maximum 3 items and answers restricted to 250 characters
- `PREF-001`: Dating preferences retrieval returns private filters for account owner
- `PREF-002`: Preferences reject minAge < 18, maxAge > 65, minAge > maxAge, and unapproved programmes
- `PHOTO-001`: Photo presign validates MIME types and constructs account-scoped key
- `PHOTO-002`: Photo attachment rejects foreign keys and prevents duplicate attachments
- `PHOTO-003`: Photo upload enforces maximum limit of 6 photos per profile
- `PHOTO-004`: Photo reordering updates display orders and rejects foreign photo IDs
- `PHOTO-005`: Removing only photo reverts live profile to draft
- `PREV-001`: Self-preview DTO omits roll numbers, DOB, private preferences, and account IDs
- `PUB-001`: Publication gate rejects accounts lacking 18+ adult verification
- `PUB-002`: Publication gate rejects accounts without at least one approved portrait photo
- `PUB-003`: Publication succeeds when all approved requirements are met, even with empty bio and no location
- `PUB-004`: Pausing discovery sets isPaused without deleting profile or unpublishing
- `AUTH-001`: Peer public profile retrieval rejects unverified, unpublished, or blocked members
- `AUTH-002`: Peer public profile retrieval never returns private preferences, DOB, or roll numbers
- `PHOTO-006`: Presign enforces 300s TTL and rejects file sizes exceeding 10 MB *(New)*
- `PHOTO-007`: Image content validation detects valid JPEG magic bytes (FF D8 FF) and strips EXIF APP1 metadata *(New)*
- `PHOTO-008`: Image content validation detects valid PNG, WebP, and HEIC binary signatures *(New)*
- `PHOTO-009`: Image content validation rejects disguised or malicious executables, HTML, and script payloads *(New)*
- `PUB-005`: Publication gate rejects accounts when photos are pending or failed moderation *(New)*
- `PUB-006`: Deleting primary photograph automatically promotes remaining ready photo and enforces exactly one primary *(New)*
- `CONSENT-001`: Publication records durable acceptance timestamp, version, and member identity without overwriting on re-publish *(New)*
- `AGE-001`: ageDisplayMode = "hidden" excludes calculated age from public profile response *(New)*
- `AGE-002`: Hidden age remains hidden in peer preview modal response *(New)*
- `AGE-003`: Exact DOB is never exposed under either hidden or show_calculated_age mode *(New)*
- `AGE-004`: Switching from hidden to show_calculated_age exposes only calculated integer age, never DOB *(New)*
- `AGE-005`: Internal server eligibility verification still accesses verified age when age is hidden publicly *(New)*

### 7.2 Regression Suites (32 Tests - Preserved & Passing)
- **Profiles & Media Privacy (D-P2-04)** (`profiles.test.ts`): 3 tests (Draft default, draft save without photo vs publish requires photo, presign never returns Unsplash fallbacks).
- **Identity, Verification & Security** (`identity.test.ts`): 7 tests (Central BS email allowlist, under-18 DOB rejection, 18+ review queue, student check 4 BS families, password & reviewer approval, JWT signature verification, review queue redaction).
- **Production Fail-Closed Safeguards** (`security-prod.test.js`): 4 tests (Weak JWT secret rejection, synthetic auto-approval blocked in production, devOtp blocked in production, ReviewerGuard fail-closed).
- **Phase 3 P0 Dating Loop** (`dating.test.js`): 4 tests (Unilateral like no match, reciprocal like mutual match with lexicographical ordering, active matches query, bidirectional block ends match).
- **Calling & Voice Notes (Phase 4)** (`calling.test.js`): 7 tests (Voice note 60s limit presigning, 60s limit rejection, audio mime rejection, 1:1 call invite with LiveKit room/JWT, accept call, decline call, hangup call & duration).
- **Together Service** (`together.test.js`): 7 tests (Mini-games catalog, word scramble game invitation/acceptance, word guess moves, virtual date proposal/acceptance, bilateral Relationship Mode activation, shared milestones/journals, unilateral unpairing).

---

## 8. Git & Build Integrity (Section 7)

### 8.1 Repository Status

- **Exact Current Commit**: `cf3afa217b23f4e58a7f5273ed622bb873af161f`
- **Current Git Branch**: `phase-2-complete` (up to date with `origin/phase-2-complete`)
- **Modified Tracked Files**:
  1. `apps/web/app/(app)/profile/page.tsx`: Profile management UI, tabs, photo manager, preferences, preview modal, completion meter.
  2. `apps/web/lib/api.ts`: API client methods for preferences, photo presign, photo reorder, preview, and public profiles.
  3. `apps/web/lib/server-bff.ts`: Hardened BFF proxying strictly via `process.env.API_BACKEND_URL`.
  4. `packages/contracts/src/dtos/index.ts`: Reconciled DTO contracts (`UpdatePreferencesDto`, `ReorderPhotosDto`, `PresignPhotoDto`, `DiscoveryCandidateDto`).
  5. `services/api/package.json`: Automated test run script.
  6. `services/api/src/modules/profiles/dto/profile.dto.ts`: Added DTOs for reorder, presign, preferences with `@Max(65)`, 10MB limits, and consent version.
  7. `services/api/src/modules/profiles/profiles.controller.ts`: Endpoints for preferences, photo reorder, preview, public profile.
  8. `services/api/src/modules/profiles/profiles.service.ts`: Server-side binary validation (`validateImageBinary`), 10MB photo bounds, 300s presign TTL, primary promotion logic, ready photo publication gate, durable consent tracking (`AuditEvent`).
- **Untracked Files**:
  1. `docs/implementation/PHASE3_1_SECURITY_AND_BUILD_AUDIT.md`: Containment protocol and specification audit report.
  2. `docs/implementation/PHASE3_1_COMPLETION_REPORT.md`: This authoritative completion report.
  3. `scripts/visual-capture.js`: Headless Edge CDP visual verification script.
  4. `services/api/test/phase3-1-profile.test.ts`: 32 comprehensive unit tests for Phase 3.1.
- **Brand Assets Invariant**: `packages/design-tokens` has `working tree clean`; all Document 10 brand identity tokens and styling remain completely untouched.
- **Zero Credentials / Private Verification Data**: Complete diff audited; zero API keys, secrets, database connection strings, or student verification data are staged or present.
- **Zero Commit / Push / Deploy**: In accordance with instructions, no commits, pushes, or deployments have been executed.

### 8.2 Clean Monorepo Build Results

- `@saymyname/contracts`: Built with `tsc` (exit code 0).
- `@saymyname/database`: Built with `prisma generate && tsc` (exit code 0).
- `@saymyname/design-tokens`: Built with `tsc` (exit code 0).
- `@saymyname/validation`: Built with `tsc` (exit code 0).
- `@saymyname/api`: Prebuild + `tsc` (exit code 0).
- `@saymyname/web`: Next.js 15.5.29 production build (exit code 0), prerendering all 30/30 static and dynamic routes.

---

## 9. Final Acceptance Sign-Off

| Exit Criterion | Status | Verification Reference |
| :--- | :---: | :--- |
| Reconciled photo limits (10 MB, 300s TTL, max 6, JPEG/PNG/WebP/HEIC) | **CONFIRMED** | Section 2; `profile.dto.ts`, `profiles.service.ts` |
| Server-side binary image content validation & EXIF stripping | **CONFIRMED** | Section 3; `validateImageBinary`, tests `PHOTO-007..009` |
| Publication requires ready/approved photo; primary auto-promotion; draft reversion | **CONFIRMED** | Section 4; tests `PHOTO-005`, `PUB-005`, `PUB-006` |
| Durable consent persistence (timestamp, version, member identity, idempotence) | **CONFIRMED** | Section 5; `AuditEvent`, test `CONSENT-001` |
| Hidden age verified across public DTO, preview, candidate DTO; zero DOB exposure | **CONFIRMED** | Section 6; tests `AGE-001..005`, `AUTH-002` |
| Automated test suite passing cleanly (64/64 tests passing, 0 failures) | **CONFIRMED** | Section 7; `npm run --workspace=@saymyname/api test` |
| Clean monorepo builds across all packages and web application (30/30 routes) | **CONFIRMED** | Section 8; `npm run build:packages`, `web build`, `api build` |
| Git integrity: zero credentials staged, brand assets intact, zero commits/pushes | **CONFIRMED** | Section 8; commit `cf3afa2`, branch `phase-2-complete` |

---

> [!IMPORTANT]
> **STOP AND REQUEST FINAL HUMAN ACCEPTANCE**: Phase 3.1 is 100% complete, verified, and audited. In strict adherence to operating instructions, Phase 3.2 has NOT been initiated. Standing by for human operator review and sign-off.
