# ADR-020: Guided Draft Onboarding & Private R2 Portrait Requirement

- **Status:** Accepted
- **Date:** 2026-11-24
- **Decision owner:** Product + Design + Engineering (`D-P2-04`)
- **Reviewers:** Privacy/Security
- **Related tasks / documents:** Document 03 (`ONB-01..06`, `PRO-01`), Document 04 (`D04-05`, `PROF-01..18`), Document 05 (§8.4), Document 06 (§5.6–5.7), `docs/decisions/DECISION_REGISTER.md`

## Context
Currently `ProfilesService.getProfile()` auto-creates `Profile` rows with `isPublished: true`, bypassing onboarding. `Profile & Account Settings` accepts a raw photo URL text box, while `presignPhoto` constructs an unconfigured `media.saymyname.in` URL or falls back to a public `images.unsplash.com` stock photo.

## Decision drivers
- Prevent unconfigured/incomplete profiles from entering Discover before guided onboarding and explicit consent.
- Guarantee authentic member portraits in Discover without third-party hotlinks or raw URL exposure.
- Keep verification/registration accessible by allowing drafts to save before portrait upload.

## Options considered
1. **`draft` default + Required Genuine R2 Portrait at Publish + Short-lived Signed GET Delivery.**
2. Allow publishing profiles with no photo (monogram only).

## Decision
Adopt Option 1 (`Accepted`).
1. New `Profile` records initialize with `profileStatus = 'draft'` (`isPublished = false`).
2. Guided multi-step onboarding (Steps 1–10 per Spec §14) lets members save partial progress (`draft`) without a photo during registration/verification and early onboarding steps.
3. **Publish Gate (`POST /api/v1/profiles/me/publish`):** Requires verified eligibility (`accountStatus = 'active'`, `discoveryEligible = true`), core profile fields (non-roll-number display name, bio, programme track visibility, relationship intention, coarse location, interests/prompts), explicit policy consent acknowledgement (`consent_accepted_at`), **AND at least 1 genuine uploaded `ProfilePhoto` stored in private R2** (`profileStatus = 'live'`, `isPublished = true`).
4. **Private R2 Media Delivery:**
   - Remove raw photo URL inputs and all Unsplash/demo portrait fallbacks across API and web client.
   - Support browser upload via presigned R2 PUT (`POST /api/v1/profiles/me/photos/presign`) + photo confirmation (`POST /api/v1/profiles/me/photos`) + deletion + ordering (`setPrimary`).
   - Validate image MIME (`image/jpeg`, `image/png`, `image/webp`) and file size bounds; strip client-supplied arbitrary URLs.
   - Serve portrait URLs solely as short-lived authorised presigned GET URLs (`<= 300s` TTL) resolved dynamically per authorised request (never persisted as permanent public URLs).

## Consequences and trade-offs
- Requires R2 credentials (`R2_*` env vars) for real object storage upload/fetch in dev/staging; local offline unit/smoke tests without R2 credentials must mock the R2 adapter cleanly without falling back to external Unsplash URLs in app bundles or Discover responses.

## Security, privacy, safety and operations impact
Eliminates public hotlinking, permanent guessable portrait URLs, and stock-image impersonation/fallback bugs.

## Migration / rollback / compatibility
Existing published `Profile` rows (5 rows observed on Supabase) retain `isPublished = true` compatibility column (`profile_status = 'live'` where `is_published = true` during backfill) so valid published state is never corrupted.

## Evidence and review date
- Target Verification: `ONB-001..010`, draft save without photo passes, publish without photo returns `400/422` refusal, upload + signed GET view renders portrait cleanly across viewports, zero Unsplash URLs anywhere in repo.
