import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { isEditorialLandingEnabled } from '../lib/landing-flag.ts';
import {
  APPROVED_PROGRAMME_FAMILIES,
  HERO_CANDIDATES,
  ONBOARDING_STEPS,
  PEER_SHARE_CANONICAL_URL,
  SAMPLE_CHAT_DATA,
  TRUST_RULES,
} from '../components/landing/landing-content.ts';

test('isEditorialLandingEnabled is strictly opt-in for literal "true"', () => {
  assert.equal(isEditorialLandingEnabled(undefined), false);
  assert.equal(isEditorialLandingEnabled(''), false);
  assert.equal(isEditorialLandingEnabled('false'), false);
  assert.equal(isEditorialLandingEnabled('1'), false);
  assert.equal(isEditorialLandingEnabled('TRUE'), false);
  assert.equal(isEditorialLandingEnabled('true '), false);
  assert.equal(isEditorialLandingEnabled('true'), true);
});

test('DEC-LP-01 canonical hero headline candidates match Phase 1/2 register verbatim', () => {
  assert.equal(HERO_CANDIDATES.A.headline, 'Same world. Different cities. A chance to meet.');
  assert.equal(HERO_CANDIDATES.B.headline, 'Built for real connection across your BS world.');
  assert.equal(
    HERO_CANDIDATES.C.headline,
    'A calmer place to meet someone who shares your pace.',
  );
});

test('approved Phase 1 BS programme families list matches exact four-track scope', () => {
  assert.deepEqual(
    APPROVED_PROGRAMME_FAMILIES.map((item) => item.name),
    [
      'Data Science and Applications',
      'Electronic Systems',
      'Aeronautics and Space Technology',
      'Management and Data Science',
    ],
  );
});

test('onboarding sequence accurately reflects five Phase 1 manual-review steps', () => {
  assert.equal(ONBOARDING_STEPS.length, 5);
  assert.ok(ONBOARDING_STEPS.some((item) => item.detail.includes('manual')));
});

test('peer share canonical URL keeps attribution parameters disabled until DEC-LP-05', () => {
  assert.equal(PEER_SHARE_CANONICAL_URL, 'https://saymyname.in');
  assert.equal(PEER_SHARE_CANONICAL_URL.includes('?src=peer'), false);
  assert.equal(PEER_SHARE_CANONICAL_URL.includes('?'), false);
});

test('product preview and hero copy do not overclaim deferred Phase 4 features', () => {
  const combinedCopy = [
    ...Object.values(HERO_CANDIDATES).map((c) => `${c.headline} ${c.subheadline}`),
    ...TRUST_RULES.map((t) => `${t.title} ${t.body}`),
    SAMPLE_CHAT_DATA.footerNote,
    ...SAMPLE_CHAT_DATA.messages.map((m) => m.text),
  ]
    .join(' ')
    .toLowerCase();

  for (const forbidden of ['livekit', 'webrtc', 'audio call', 'video call', 'voice note', 'mini-game', 'relationship mode']) {
    assert.equal(
      combinedCopy.includes(forbidden),
      false,
      `Forbidden deferred feature mention found: ${forbidden}`,
    );
  }
});

test('approved Phase 5 public static assets (3D-01 + OG Direction A) exist on disk without placeholder photos', () => {
  const publicLandingDir = path.resolve(import.meta.dirname, '..', 'public', 'images', 'landing');
  for (const rel of [
    '3d/two-lights-desktop-10bit.avif',
    '3d/two-lights-desktop-8bit.avif',
    '3d/two-lights-desktop.webp',
    '3d/two-lights-mobile-10bit.avif',
    '3d/two-lights-mobile.webp',
    '3d/two-lights-detail.webp',
    'og/saymyname-og-direction-a.png',
  ]) {
    assert.equal(fs.existsSync(path.join(publicLandingDir, rel)), true, `Missing asset: ${rel}`);
  }
  assert.equal(fs.existsSync(path.join(publicLandingDir, 'photography')), false);
});
