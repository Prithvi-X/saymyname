/**
 * SayMyName Manual Verification Review CLI (D-P2-01 / ADR-017)
 *
 * Operates the manual human review queue over the fail-closed ReviewerGuard endpoints.
 * Note: SayMyName Phase 2 uses internal manual review; no automated third-party provider is integrated.
 *
 * Usage:
 *   REVIEWER_API_KEY=<key> REVIEWER_ID=<id> node scripts/review-verification-queue.mjs list [pending|needs_information|all_open]
 *   REVIEWER_API_KEY=<key> REVIEWER_ID=<id> node scripts/review-verification-queue.mjs evidence <evidenceId>
 *   REVIEWER_API_KEY=<key> REVIEWER_ID=<id> node scripts/review-verification-queue.mjs decide <caseId> <approved|needs_information|rejected> [reasonCode] [rejectionReason]
 */

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:4000/api/v1';
const REVIEWER_KEY = process.env.REVIEWER_API_KEY || '';
const REVIEWER_ID = process.env.REVIEWER_ID || 'ops_manual_reviewer';

function requireKey() {
  if (!REVIEWER_KEY || REVIEWER_KEY.length < 16) {
    console.error('ERROR: Set REVIEWER_API_KEY (min 16 chars) in environment before invoking reviewer CLI.');
    process.exit(1);
  }
}

async function req(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-smn-reviewer-key': REVIEWER_KEY,
      'x-smn-reviewer-id': REVIEWER_ID,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${json?.message || text}`);
    process.exit(1);
  }
  return json;
}

async function main() {
  requireKey();
  const [cmd = 'list', arg1, arg2, arg3, ...rest] = process.argv.slice(2);

  if (cmd === 'list') {
    const status = arg1 || 'all_open';
    const data = await req(`/verification-cases/pending?status=${encodeURIComponent(status)}`);
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (cmd === 'evidence') {
    if (!arg1) {
      console.error('Usage: evidence <evidenceId>');
      process.exit(1);
    }
    const data = await req(`/verification-cases/evidence/${encodeURIComponent(arg1)}/url`);
    console.log(JSON.stringify({
      evidenceId: data.evidenceId,
      expiresInSeconds: data.expiresInSeconds,
      mimeType: data.mimeType,
      adapterMode: data.adapterMode,
      signedUrlIssued: Boolean(data.signedUrl),
      signedUrl: data.signedUrl,
    }, null, 2));
    return;
  }

  if (cmd === 'decide') {
    const caseId = arg1;
    const decision = arg2;
    const reasonCode = arg3;
    const rejectionReason = rest.length ? rest.join(' ') : undefined;
    if (!caseId || !['approved', 'needs_information', 'rejected'].includes(decision)) {
      console.error('Usage: decide <caseId> <approved|needs_information|rejected> [reasonCode] [rejectionReason]');
      process.exit(1);
    }
    const body = { decision };
    if (reasonCode) body.reasonCode = reasonCode;
    if (rejectionReason) body.rejectionReason = rejectionReason;
    const data = await req(`/verification-cases/${encodeURIComponent(caseId)}/decision`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.error(`Unknown subcommand: ${cmd}`);
  process.exit(1);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
