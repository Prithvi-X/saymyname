---
trigger: always_on
description: Security, privacy, sensitive-data handling, identity verification, least privilege, secrets and safe tool-use rules for SayMyName.
---

# Security and privacy invariants

- Default deny: verify authentication, current eligibility, resource ownership, match state, block state and role on every protected operation.
- Never trust client-supplied role, verification status, eligibility, match state, game outcome or Relationship Mode activation.
- Use synthetic test identities and media only. Never place real student documents, identity numbers, private chats, photos or contact lists in prompts, fixtures, logs or screenshots.
- Never commit secrets, .env files, private keys, database credentials, provider tokens or signed media URLs.
- Never log passwords, tokens, student evidence, private message content, private relationship details or precise user location.
- Do not weaken TLS/certificate checks, CSRF, CSP, rate limits, access controls, logging redaction or security scans to make tests pass.
- Ask before changing authentication, verification, E2EE, retention, deletion, cloud region, provider contracts, production access or security posture.
- Never deploy to production, alter production secrets, export real user data or delete production data without explicit human approval.
