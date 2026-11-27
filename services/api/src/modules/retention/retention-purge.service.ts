import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaService } from '../../prisma/prisma.service';

export interface RetentionPolicyConfig {
  unmatchQuarantineDays: number;
  blockQuarantineDays: number;
  accountDeletionGraceDays: number;
  expiredAuthCleanupDays: number;
  batchLimit: number;
  dryRun: boolean;
}

export interface RetentionSweepSummary {
  dryRun: boolean;
  purgedConversations: number;
  purgedMessages: number;
  purgedMediaObjects: number;
  purgedAccounts: number;
  skippedLegalHoldCount: number;
  cleanedAuthTokens: number;
  storageErrors: number;
}

function positiveIntEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

@Injectable()
export class RetentionPurgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionPurgeService.name);
  private sweepTimer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (
      process.env.DISABLE_RETENTION_WORKER === 'true' ||
      process.env.NODE_ENV === 'test'
    ) {
      return;
    }

    const intervalMs = positiveIntEnv('RETENTION_SWEEP_INTERVAL_MS', 6 * 60 * 60 * 1000);
    this.sweepTimer = setInterval(() => {
      void this.runRetentionSweep().catch(() => null);
    }, intervalMs);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  getPolicyConfig(overrides?: Partial<RetentionPolicyConfig>): RetentionPolicyConfig {
    return {
      unmatchQuarantineDays:
        overrides?.unmatchQuarantineDays ??
        positiveIntEnv('RETENTION_UNMATCH_DAYS', 30),
      blockQuarantineDays:
        overrides?.blockQuarantineDays ??
        positiveIntEnv('RETENTION_BLOCK_DAYS', 90),
      accountDeletionGraceDays:
        overrides?.accountDeletionGraceDays ??
        positiveIntEnv('RETENTION_ACCOUNT_DELETE_DAYS', 30),
      expiredAuthCleanupDays:
        overrides?.expiredAuthCleanupDays ??
        positiveIntEnv('RETENTION_AUTH_CLEANUP_DAYS', 7),
      batchLimit: overrides?.batchLimit ?? 50,
      dryRun:
        overrides?.dryRun ?? process.env.RETENTION_DRY_RUN === 'true',
    };
  }

  private createR2Client(): { client: S3Client; bucket: string } | null {
    const bucket = process.env.R2_BUCKET_NAME;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint =
      process.env.R2_ENDPOINT ||
      (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : undefined);

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      return null;
    }

    let isCloudflareR2Host = false;
    try {
      isCloudflareR2Host = /(?:^|\.)r2\.cloudflarestorage\.com$/i.test(
        new URL(endpoint).hostname,
      );
    } catch {
      isCloudflareR2Host = false;
    }
    const forcePathStyle =
      !isCloudflareR2Host && process.env.R2_FORCE_PATH_STYLE === 'true';

    return {
      bucket,
      client: new S3Client({
        region: 'auto',
        endpoint,
        ...(forcePathStyle ? { forcePathStyle: true } : {}),
        credentials: { accessKeyId, secretAccessKey },
      }),
    };
  }

  /**
   * Deletes S3/R2 objects strictly outside database transactions (database-change Rule 7).
   * Treats 404/NoSuchKey as already absent; returns failed keys when object storage returns 5xx.
   */
  private async deleteStorageObjects(
    keys: string[],
  ): Promise<{ deletedCount: number; failedKeys: Set<string> }> {
    const uniqueKeys = Array.from(new Set(keys.filter((k) => Boolean(k && k.trim()))));
    const failedKeys = new Set<string>();
    if (uniqueKeys.length === 0) {
      return { deletedCount: 0, failedKeys };
    }

    const r2 = this.createR2Client();
    if (!r2) {
      // Non-production local stub mode without S3/R2 configured
      return { deletedCount: uniqueKeys.length, failedKeys };
    }

    let deletedCount = 0;
    for (const key of uniqueKeys) {
      try {
        await r2.client.send(
          new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }),
        );
        deletedCount++;
      } catch (err: any) {
        const status = err?.$metadata?.httpStatusCode;
        const name = String(err?.name || '');
        if (status === 404 || name === 'NoSuchKey' || name === 'NotFound') {
          deletedCount++;
        } else {
          failedKeys.add(key);
        }
      }
    }
    return { deletedCount, failedKeys };
  }

  /**
   * Computes active legal holds protecting conversations, messages, accounts, and S3 keys
   * from automated DPDP purge while safety investigations or 180-day holds remain open.
   */
  private async loadActiveLegalHolds(now: Date) {
    const prismaAny = this.prisma as any;
    const reports: any[] =
      typeof prismaAny.report?.findMany === 'function'
        ? await prismaAny.report
            .findMany({
              where: {
                OR: [
                  { status: { in: ['pending', 'under_review'] } },
                  { legalHoldUntil: { gt: now } },
                ],
              },
              include: {
                evidence: {
                  where: { deletedAt: null },
                  select: { s3Key: true, retentionUntil: true },
                },
              },
            })
            .catch(() => [])
        : [];

    const heldReportedAccountIds = new Set<string>();
    const heldConversationIds = new Set<string>();
    const heldPairKeys = new Set<string>();
    const heldMessageIds = new Set<string>();
    const heldS3Keys = new Set<string>();

    for (const report of reports) {
      if (report.reportedId) heldReportedAccountIds.add(report.reportedId);
      if (report.conversationId) {
        heldConversationIds.add(report.conversationId);
      } else if (report.reporterId && report.reportedId) {
        heldPairKeys.add([report.reporterId, report.reportedId].sort().join(':'));
      }
      if (report.messageId) heldMessageIds.add(report.messageId);
      for (const ev of report.evidence || []) {
        if (!ev.retentionUntil || new Date(ev.retentionUntil) > now) {
          if (ev.s3Key) heldS3Keys.add(ev.s3Key);
        }
      }
    }

    return {
      heldReportedAccountIds,
      heldConversationIds,
      heldPairKeys,
      heldMessageIds,
      heldS3Keys,
    };
  }

  async runRetentionSweep(
    overrides?: Partial<RetentionPolicyConfig>,
  ): Promise<RetentionSweepSummary> {
    if (this.sweeping) {
      return {
        dryRun: Boolean(overrides?.dryRun),
        purgedConversations: 0,
        purgedMessages: 0,
        purgedMediaObjects: 0,
        purgedAccounts: 0,
        skippedLegalHoldCount: 0,
        cleanedAuthTokens: 0,
        storageErrors: 0,
      };
    }

    this.sweeping = true;
    try {
      const cfg = this.getPolicyConfig(overrides);
      const now = new Date();
      const unmatchCutoff = new Date(
        now.getTime() - cfg.unmatchQuarantineDays * 24 * 60 * 60 * 1000,
      );
      const blockCutoff = new Date(
        now.getTime() - cfg.blockQuarantineDays * 24 * 60 * 60 * 1000,
      );
      const deleteAccountCutoff = new Date(
        now.getTime() - cfg.accountDeletionGraceDays * 24 * 60 * 60 * 1000,
      );
      const authCutoff = new Date(
        now.getTime() - cfg.expiredAuthCleanupDays * 24 * 60 * 60 * 1000,
      );

      const summary: RetentionSweepSummary = {
        dryRun: cfg.dryRun,
        purgedConversations: 0,
        purgedMessages: 0,
        purgedMediaObjects: 0,
        purgedAccounts: 0,
        skippedLegalHoldCount: 0,
        cleanedAuthTokens: 0,
        storageErrors: 0,
      };

      const holds = await this.loadActiveLegalHolds(now);

      // Load active block pairs once so Match.status='ended' respects 90d block vs 30d unmatch window
      const prismaAny = this.prisma as any;
      const blocks: Array<{ blockerId: string; blockedId: string }> =
        typeof prismaAny.userBlock?.findMany === 'function'
          ? await prismaAny.userBlock
              .findMany({ select: { blockerId: true, blockedId: true } })
              .catch(() => [])
          : [];
      const blockedPairKeys = new Set<string>(
        blocks.map((b) => [b.blockerId, b.blockedId].sort().join(':')),
      );

      // 1. Ended matches: Unmatch (30d) & Block (90d) conversation message/media purge
      const expiredMatches = await this.prisma.match
        .findMany({
          where: {
            status: { in: ['ended', 'unmatched', 'blocked'] },
            endedAt: { lte: unmatchCutoff },
          },
          include: { conversation: { select: { id: true } } },
          take: cfg.batchLimit,
        })
        .catch(() => []);

      for (const match of expiredMatches) {
        const convId = match.conversation?.id;
        if (!convId) continue;

        const pairKey = [match.userLowId, match.userHighId].sort().join(':');
        const isBlockEnded =
          match.status === 'blocked' ||
          blockedPairKeys.has(pairKey) ||
          String((match as any).endReason || '').toLowerCase().includes('block');
        if (isBlockEnded && match.endedAt && match.endedAt > blockCutoff) {
          // Enforce full 90-day quarantine on block-ended conversations
          continue;
        }

        if (
          holds.heldConversationIds.has(convId) ||
          holds.heldPairKeys.has(pairKey)
        ) {
          summary.skippedLegalHoldCount++;
          continue;
        }

        const msgCount = await this.prisma.message.count({
          where: { conversationId: convId },
        });
        if (msgCount === 0) continue;

        const mediaRows = await this.prisma.messageMedia.findMany({
          where: {
            message: { conversationId: convId },
            purgedAt: null,
          },
          select: { id: true, s3Key: true, messageId: true },
        });

        if (cfg.dryRun) {
          summary.purgedConversations++;
          summary.purgedMessages += msgCount;
          summary.purgedMediaObjects += mediaRows.length;
          continue;
        }

        const deletableKeys = mediaRows
          .filter(
            (m) =>
              !holds.heldMessageIds.has(m.messageId) &&
              !holds.heldS3Keys.has(m.s3Key),
          )
          .map((m) => m.s3Key);

        const { deletedCount, failedKeys } =
          await this.deleteStorageObjects(deletableKeys);
        summary.purgedMediaObjects += deletedCount;
        summary.storageErrors += failedKeys.size;

        if (failedKeys.size > 0) {
          // Leave DB rows intact so transient S3 outage can retry safely on next sweep
          continue;
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.messageMedia.deleteMany({
            where: {
              message: {
                conversationId: convId,
                id: { notIn: Array.from(holds.heldMessageIds) },
              },
            },
          });
          const delMsgs = await tx.message.deleteMany({
            where: {
              conversationId: convId,
              id: { notIn: Array.from(holds.heldMessageIds) },
            },
          });
          summary.purgedMessages += delMsgs.count;
          await tx.auditEvent
            .create({
              data: {
                action: 'retention.match_purged',
                resourceType: 'conversation',
                resourceId: convId,
                metadata: {
                  matchStatus: match.status,
                  messagesPurged: delMsgs.count,
                  mediaObjectsPurged: deletedCount,
                },
              },
            })
            .catch(() => null);
        });
        summary.purgedConversations++;
      }

      // 2. Deleted Account hard purge after 30-day grace window
      const expiredAccounts = await this.prisma.account
        .findMany({
          where: {
            accountStatus: 'disabled',
            deletedAt: { lte: deleteAccountCutoff },
          },
          include: {
            profile: {
              include: {
                photos: { select: { id: true, s3Key: true } },
              },
            },
          },
          take: cfg.batchLimit,
        })
        .catch(() => []);

      for (const acc of expiredAccounts) {
        if (holds.heldReportedAccountIds.has(acc.id)) {
          summary.skippedLegalHoldCount++;
          if (!cfg.dryRun) {
            await this.prisma.auditEvent
              .create({
                data: {
                  action: 'retention.account_purge_deferred_legal_hold',
                  resourceType: 'account',
                  resourceId: acc.id,
                  metadata: { reason: 'active_safety_legal_hold' },
                },
              })
              .catch(() => null);
          }
          continue;
        }

        const photoKeys = (acc.profile?.photos || [])
          .map((p) => p.s3Key)
          .filter((k) => !holds.heldS3Keys.has(k));

        const sentMedia = await this.prisma.messageMedia
          .findMany({
            where: {
              message: { senderAccountId: acc.id },
              purgedAt: null,
            },
            select: { id: true, s3Key: true, messageId: true },
          })
          .catch(() => []);

        const sentMediaKeys = sentMedia
          .filter(
            (m) =>
              !holds.heldMessageIds.has(m.messageId) &&
              !holds.heldS3Keys.has(m.s3Key),
          )
          .map((m) => m.s3Key);

        if (cfg.dryRun) {
          summary.purgedAccounts++;
          summary.purgedMediaObjects += photoKeys.length + sentMediaKeys.length;
          continue;
        }

        const { deletedCount, failedKeys } = await this.deleteStorageObjects([
          ...photoKeys,
          ...sentMediaKeys,
        ]);
        summary.purgedMediaObjects += deletedCount;
        summary.storageErrors += failedKeys.size;
        if (failedKeys.size > 0) {
          continue;
        }

        await this.prisma.$transaction(async (tx) => {
          if (acc.profile?.id) {
            await tx.profilePhoto.deleteMany({
              where: { profileId: acc.profile.id },
            });
            await tx.profileInterest.deleteMany({
              where: { profileId: acc.profile.id },
            });
            await tx.profilePromptAnswer.deleteMany({
              where: { profileId: acc.profile.id },
            });
            await tx.preferenceSetting.deleteMany({
              where: { profileId: acc.profile.id },
            });
            await tx.profile.deleteMany({ where: { id: acc.profile.id } });
          }

          await tx.appSession.deleteMany({ where: { accountId: acc.id } });
          await tx.otpChallenge.deleteMany({ where: { accountId: acc.id } });
          await tx.passwordResetToken.deleteMany({
            where: { accountId: acc.id },
          });
          await tx.userDevice.deleteMany({ where: { accountId: acc.id } });
          await tx.notificationPreference.deleteMany({
            where: { accountId: acc.id },
          });

          if (sentMedia.length > 0) {
            await tx.messageMedia.deleteMany({
              where: {
                id: { in: sentMedia.map((m) => m.id) },
              },
            });
          }
          await tx.message.deleteMany({
            where: {
              senderAccountId: acc.id,
              id: { notIn: Array.from(holds.heldMessageIds) },
            },
          });

          await tx.account.update({
            where: { id: acc.id },
            data: {
              email: `deleted+${acc.id}@redacted.invalid`,
              authSubject: `deleted:${acc.id}`,
              displayName: 'Deleted Member',
              phoneNumber: null,
              passwordHash: null,
              accountStatus: 'deleted',
            },
          });

          await tx.auditEvent
            .create({
              data: {
                action: 'retention.account_purged',
                resourceType: 'account',
                resourceId: acc.id,
                metadata: {
                  mediaObjectsPurged: deletedCount,
                },
              },
            })
            .catch(() => null);
        });
        summary.purgedAccounts++;
      }

      // 3. Stale Auth challenge / password reset cleanup
      if (!cfg.dryRun) {
        const otpDel = await this.prisma.otpChallenge
          .deleteMany({ where: { expiresAt: { lt: authCutoff } } })
          .catch(() => ({ count: 0 }));
        const pwdDel = await this.prisma.passwordResetToken
          .deleteMany({ where: { expiresAt: { lt: authCutoff } } })
          .catch(() => ({ count: 0 }));
        summary.cleanedAuthTokens = (otpDel.count || 0) + (pwdDel.count || 0);
      }

      this.logger.log(
        JSON.stringify({
          component: 'RetentionPurge',
          ...summary,
        }),
      );
      return summary;
    } finally {
      this.sweeping = false;
    }
  }
}
