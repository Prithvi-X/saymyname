---
name: saymyname-verify-feature
description: Independently verifies a SayMyName feature against requirements, acceptance criteria, security/privacy rules, cross-platform behaviour and automated tests. Use before accepting a feature or reviewing a pull request.
---

# SayMyName Feature Verification

## Procedure

1. Read the linked requirement, Document 04 acceptance criteria, applicable Document 03/06 contracts and Document 07 test plan.
2. Inspect the proposed diff independently. Do not assume the implementation report is accurate.
3. Check success, negative, permission-denied, race, retry, offline and recovery cases that apply.
4. Check object ownership and server-side enforcement for protected resources.
5. Check API/schema/event compatibility and migration safety.
6. Check accessibility, responsive behaviour and real-device requirements where relevant.
7. Run available tests or inspect trustworthy CI evidence. State exactly what was not tested.
8. Classify findings by severity and provide file/line references and reproduction conditions.
9. Recommend ACCEPT, REVISE or BLOCK. Never approve the production release.

## Output

Return a findings table, test evidence, residual risks, open decisions and explicit acceptance recommendation. Absence of detected defects is not proof of exhaustive security.
