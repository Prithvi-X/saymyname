/**
 * SayMyName — Synthetic 26-Row Local Remediation Preview & Rollback Verifier (Task 1 & 2)
 *
 * SAFETY GUARD:
 * - Refuses to connect to any non-localhost Postgres target.
 * - Uses local Docker PostgreSQL (`saymyname-postgres`) to create a disposable DB
 *   `saymyname_remediation_preview`, seeds a synthetic 26-account mirror matching the
 *   exact observed non-PII aggregate shape of remote Supabase, applies Phase 2 migration
 *   + non-destructive remediation SQL, prints exact BEFORE / AFTER / RESTORE counts,
 *   and drops the disposable local DB cleanly.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CONTAINER = process.env.POSTGRES_CONTAINER || 'saymyname-postgres';
const PG_USER = process.env.POSTGRES_USER || 'saymyname_user';
const PREVIEW_DB = 'saymyname_remediation_preview';

if (process.env.DATABASE_URL) {
  const host = new URL(process.env.DATABASE_URL).hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) {
    throw new Error(`SAFETY ABORT: Non-localhost DATABASE_URL host "${host}" rejected.`);
  }
}

function psql(db, sql) {
  return execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', PG_USER, '-d', db, '-v', 'ON_ERROR_STOP=1', '-t', '-A'],
    { input: sql, encoding: 'utf8' },
  ).trim();
}

function queryCounts(db) {
  const jsonStr = psql(
    db,
    `
    SELECT json_build_object(
      'accountsByStatus', (
        SELECT coalesce(json_object_agg(account_status, cnt), '{}'::json)
        FROM (SELECT account_status, COUNT(*)::int AS cnt FROM identity.accounts GROUP BY account_status ORDER BY account_status) s
      ),
      'eligibility', (
        SELECT json_build_object(
          'total', COUNT(*)::int,
          'discovery_eligible_true', COUNT(*) FILTER (WHERE discovery_eligible = true)::int,
          'discovery_eligible_false', COUNT(*) FILTER (WHERE discovery_eligible = false)::int,
          'age_approved', COUNT(*) FILTER (WHERE age_status = 'approved')::int,
          'age_pending', COUNT(*) FILTER (WHERE age_status = 'pending')::int,
          'age_rejected', COUNT(*) FILTER (WHERE age_status = 'rejected')::int,
          'age_not_started', COUNT(*) FILTER (WHERE age_status = 'not_started')::int,
          'student_approved', COUNT(*) FILTER (WHERE student_status = 'approved')::int,
          'student_pending', COUNT(*) FILTER (WHERE student_status = 'pending')::int,
          'student_not_started', COUNT(*) FILTER (WHERE student_status = 'not_started')::int,
          'verified_by_auto', COUNT(*) FILTER (WHERE verified_by = 'automated_rules_engine')::int,
          'verified_by_null', COUNT(*) FILTER (WHERE verified_by IS NULL)::int
        ) FROM identity.account_eligibility
      ),
      'verificationCases', (
        SELECT coalesce(json_object_agg(status, cnt), '{}'::json)
        FROM (SELECT status, COUNT(*)::int AS cnt FROM identity.verification_cases GROUP BY status ORDER BY status) c
      ),
      'profiles', (
        SELECT json_build_object(
          'total_profiles', COUNT(*)::int,
          'published_true', COUNT(*) FILTER (WHERE is_published = true)::int,
          'published_false', COUNT(*) FILTER (WHERE is_published = false)::int,
          'status_live', COUNT(*) FILTER (WHERE profile_status = 'live')::int,
          'status_paused', COUNT(*) FILTER (WHERE profile_status = 'paused')::int,
          'status_draft', COUNT(*) FILTER (WHERE profile_status = 'draft')::int
        ) FROM profiles.profiles
      )
    )::text;
    `,
  );
  return JSON.parse(jsonStr);
}

function buildSyntheticSeedSql() {
  const publishedIndices = new Set([17, 18, 20, 23, 24]);
  const activeIndices = new Set([1, 2, 4, 6, 8, 10, 12, 14, 16, 17, 18, 20, 22, 23, 24, 26]);
  const rejectedIndices = new Set([3, 5, 7, 9, 11, 13, 15, 21, 25]);
  const lines = ['BEGIN;'];

  for (let i = 1; i <= 26; i++) {
    const id = crypto.randomUUID();
    const domain = i % 3 === 0 ? 'es.study.iitm.ac.in' : 'ds.study.iitm.ac.in';
    const email = `synthetic_acct_${i}@${domain}`;
    const isActive = activeIndices.has(i);
    const isRejected = rejectedIndices.has(i);

    lines.push(
      `INSERT INTO identity.accounts (id, auth_subject, email, account_status, updated_at) VALUES ('${id}', 'auth_${id}', '${email}', '${isActive ? 'active' : 'pending_verification'}', now());`,
    );

    if (isActive) {
      lines.push(
        `INSERT INTO identity.account_eligibility (account_id, age_status, student_status, programme_family, discovery_eligible, verified_by, verified_at, updated_at) VALUES ('${id}', 'approved', 'approved', 'data_science_applications', true, 'automated_rules_engine', now(), now());`,
      );
    } else if (isRejected) {
      lines.push(
        `INSERT INTO identity.account_eligibility (account_id, age_status, student_status, programme_family, discovery_eligible, verified_by, verified_at, updated_at) VALUES ('${id}', 'rejected', 'approved', 'electronic_systems', false, 'automated_rules_engine', now(), now());`,
      );
    } else {
      lines.push(
        `INSERT INTO identity.account_eligibility (account_id, age_status, student_status, programme_family, discovery_eligible, verified_by, updated_at) VALUES ('${id}', 'not_started', 'not_started', NULL, false, NULL, now());`,
      );
    }

    if (publishedIndices.has(i)) {
      lines.push(
        `INSERT INTO profiles.profiles (id, account_id, display_name, programme_family, is_published, is_paused, updated_at) VALUES ('${crypto.randomUUID()}', '${id}', 'Synthetic Member ${i}', 'data_science_applications', true, false, now());`,
      );
    }
  }
  lines.push('COMMIT;');
  return lines.join('\n');
}

function run() {
  psql('postgres', `DROP DATABASE IF EXISTS ${PREVIEW_DB} WITH (FORCE);`);
  psql('postgres', `CREATE DATABASE ${PREVIEW_DB};`);

  try {
    const baselineSql = fs.readFileSync(
      path.resolve('packages/database/prisma/migrations/00000000000000_baseline/migration.sql'),
      'utf8',
    );
    psql(PREVIEW_DB, baselineSql);
    psql(PREVIEW_DB, buildSyntheticSeedSql());

    const phase2Sql = fs.readFileSync(
      path.resolve(
        'packages/database/prisma/migrations/20261124000000_phase2_identity_auth_verification_profiles/migration.sql',
      ),
      'utf8',
    );
    psql(PREVIEW_DB, phase2Sql);

    const beforeRemediation = queryCounts(PREVIEW_DB);
    assert.equal(beforeRemediation.accountsByStatus.active, 16);
    assert.equal(beforeRemediation.accountsByStatus.pending_verification, 10);
    assert.equal(beforeRemediation.eligibility.age_approved, 16);
    assert.equal(beforeRemediation.eligibility.age_rejected, 9);
    assert.equal(beforeRemediation.eligibility.age_not_started, 1);
    assert.equal(beforeRemediation.eligibility.student_approved, 25);
    assert.equal(beforeRemediation.profiles.published_true, 5);
    assert.equal(beforeRemediation.profiles.status_live, 5);

    // Apply non-destructive remediation preview with reversible snapshot backup schema
    psql(
      PREVIEW_DB,
      `
      BEGIN;

      CREATE SCHEMA IF NOT EXISTS _remediation_backup;
      CREATE TABLE _remediation_backup.accounts_snapshot AS SELECT id, account_status FROM identity.accounts;
      CREATE TABLE _remediation_backup.eligibility_snapshot AS
      SELECT account_id, age_status, student_status, discovery_eligible, age_verified_at, student_verified_at, verified_by, verified_at
      FROM identity.account_eligibility;
      CREATE TABLE _remediation_backup.profiles_snapshot AS SELECT id, is_published, profile_status FROM profiles.profiles;

      -- Group A (16 auto-approved accounts without VerificationCase): move to pending review
      UPDATE identity.account_eligibility ae
      SET
        age_status = 'pending',
        student_status = 'pending',
        discovery_eligible = false,
        age_verified_at = NULL,
        student_verified_at = NULL,
        verified_by = NULL,
        verified_at = NULL,
        updated_at = now()
      WHERE ae.verified_by = 'automated_rules_engine'
        AND ae.age_status = 'approved'
        AND ae.student_status = 'approved'
        AND NOT EXISTS (
          SELECT 1 FROM identity.verification_cases vc
          WHERE vc.account_id = ae.account_id AND vc.status = 'approved'
        );

      UPDATE identity.accounts a
      SET
        account_status = 'pending_verification',
        updated_at = now()
      FROM identity.account_eligibility ae
      WHERE ae.account_id = a.id
        AND a.account_status = 'active'
        AND ae.discovery_eligible = false;

      -- Pause the 5 published profiles non-destructively while eligibility is under review
      UPDATE profiles.profiles p
      SET
        is_published = false,
        profile_status = 'paused',
        updated_at = now()
      FROM identity.account_eligibility ae
      WHERE ae.account_id = p.account_id
        AND ae.discovery_eligible = false
        AND p.is_published = true;

      -- Group B (9 rejected-age accounts with stale student_status='approved'): clear contradictory approval
      UPDATE identity.account_eligibility ae
      SET
        student_status = 'not_started',
        student_verified_at = NULL,
        verified_by = NULL,
        verified_at = NULL,
        discovery_eligible = false,
        updated_at = now()
      WHERE ae.age_status = 'rejected'
        AND (ae.student_status = 'approved' OR ae.verified_by = 'automated_rules_engine');

      -- Seed pending manual_review cases for the 16 remediated accounts so reviewer queue is immediately operable
      INSERT INTO identity.verification_cases (id, account_id, check_type, provider_code, status, reason_code, submitted_at, created_at)
      SELECT
        gen_random_uuid(),
        ae.account_id,
        t.check_type,
        'manual_review',
        'pending',
        'phase2_legacy_remediation',
        now(),
        now()
      FROM identity.account_eligibility ae
      CROSS JOIN (VALUES ('age'), ('student_enrolment')) AS t(check_type)
      WHERE ae.age_status = 'pending'
        AND ae.student_status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM identity.verification_cases vc
          WHERE vc.account_id = ae.account_id AND vc.check_type = t.check_type AND vc.status IN ('pending', 'approved')
        );

      COMMIT;
      `,
    );

    const afterRemediation = queryCounts(PREVIEW_DB);
    assert.equal(afterRemediation.accountsByStatus.active || 0, 0);
    assert.equal(afterRemediation.accountsByStatus.pending_verification, 26);
    assert.equal(afterRemediation.eligibility.discovery_eligible_true, 0);
    assert.equal(afterRemediation.eligibility.age_pending, 16);
    assert.equal(afterRemediation.eligibility.age_rejected, 9);
    assert.equal(afterRemediation.eligibility.age_not_started, 1);
    assert.equal(afterRemediation.eligibility.student_pending, 16);
    assert.equal(afterRemediation.eligibility.student_not_started, 10);
    assert.equal(afterRemediation.eligibility.verified_by_auto, 0);
    assert.equal(afterRemediation.eligibility.verified_by_null, 26);
    assert.equal(afterRemediation.profiles.total_profiles, 5);
    assert.equal(afterRemediation.profiles.published_true, 0);
    assert.equal(afterRemediation.profiles.status_paused, 5);
    assert.equal(afterRemediation.verificationCases.pending, 32);

    // Verify full reversible rollback restores exact pre-remediation aggregate state
    psql(
      PREVIEW_DB,
      `
      BEGIN;
      DELETE FROM identity.verification_cases WHERE reason_code = 'phase2_legacy_remediation';
      UPDATE identity.account_eligibility ae
      SET
        age_status = b.age_status,
        student_status = b.student_status,
        discovery_eligible = b.discovery_eligible,
        age_verified_at = b.age_verified_at,
        student_verified_at = b.student_verified_at,
        verified_by = b.verified_by,
        verified_at = b.verified_at
      FROM _remediation_backup.eligibility_snapshot b WHERE ae.account_id = b.account_id;
      UPDATE identity.accounts a SET account_status = b.account_status FROM _remediation_backup.accounts_snapshot b WHERE a.id = b.id;
      UPDATE profiles.profiles p SET is_published = b.is_published, profile_status = b.profile_status FROM _remediation_backup.profiles_snapshot b WHERE p.id = b.id;
      DROP SCHEMA _remediation_backup CASCADE;
      COMMIT;
      `,
    );

    const afterRollback = queryCounts(PREVIEW_DB);
    assert.deepEqual(afterRollback, beforeRemediation, 'Rollback must restore exact pre-remediation state');

    console.log(JSON.stringify({ beforeRemediation, afterRemediation, afterRollback }, null, 2));
    console.log('\nPASS: 26-account remediation + rollback verified with 0 data loss and 0 PII.');
  } finally {
    psql('postgres', `DROP DATABASE IF EXISTS ${PREVIEW_DB} WITH (FORCE);`);
  }
}

run();
