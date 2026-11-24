import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { isPrivateIdentifierLike, validateProfile } from '@saymyname/validation';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpdateProfileDto,
  AddPhotoDto,
  UpdatePreferencesDto,
  PresignPhotoDto,
  PublishProfileDto,
} from './dto/profile.dto';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const DEFAULT_INTERESTS_CATALOG = [
  { name: 'Machine Learning', category: 'academic' },
  { name: 'Statistics & Math', category: 'academic' },
  { name: 'Embedded Systems', category: 'academic' },
  { name: 'Aerospace & Space Tech', category: 'academic' },
  { name: 'Classical Music', category: 'culture' },
  { name: 'Indie Cinema', category: 'culture' },
  { name: 'Literature & Philosophy', category: 'culture' },
  { name: 'Chess & Strategy', category: 'lifestyle' },
  { name: 'Late-Night Study Calls', category: 'lifestyle' },
  { name: 'Coffee & Walks', category: 'lifestyle' },
  { name: 'Open Source', category: 'academic' },
  { name: 'Photography', category: 'culture' },
];

const DEFAULT_PROMPTS_CATALOG = [
  {
    promptText: 'What is one IITM BS course or concept that genuinely surprised you?',
    category: 'academics',
  },
  {
    promptText: 'A quiet Sunday afternoon when classes are paused looks like...',
    category: 'rhythm',
  },
  {
    promptText: 'What makes a long-distance connection feel thoughtful rather than rushed?',
    category: 'values',
  },
  {
    promptText: 'Two things we could bond over during an audio call this week...',
    category: 'conversation',
  },
  {
    promptText: 'Outside coursework, I spend way too much time thinking about...',
    category: 'curiosity',
  },
];

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      bucket,
      client: new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      }),
    };
  }

  /**
   * Short-lived authorised signed GET URL generator for private R2 portraits (D-P2-04).
   * Never uses public fallback domains or external stock photos.
   */
  async signPhotoUrl(s3Key: string, ttlSeconds = 180): Promise<string | null> {
    if (!s3Key) return null;
    const r2 = this.createR2Client();
    if (!r2) return null;
    try {
      return await getSignedUrl(
        r2.client,
        new GetObjectCommand({ Bucket: r2.bucket, Key: s3Key }),
        { expiresIn: ttlSeconds },
      );
    } catch {
      return null;
    }
  }

  async hydrateProfileMedia<T extends { photos?: Array<any> }>(profile: T): Promise<T> {
    if (!profile || !Array.isArray(profile.photos)) return profile;
    const activePhotos = profile.photos.filter((p) => !p.deletedAt);
    const hydratedPhotos = await Promise.all(
      activePhotos.map(async (p) => {
        const signed = await this.signPhotoUrl(p.s3Key, 180);
        return {
          id: p.id,
          profileId: p.profileId,
          photoUrl: signed,
          displayOrder: p.displayOrder,
          isPrimary: p.isPrimary,
          moderationStatus: p.moderationStatus,
          mimeType: p.mimeType || null,
          createdAt: p.createdAt,
        };
      }),
    );
    return {
      ...profile,
      photos: hydratedPhotos,
    };
  }

  /**
   * Ensures & returns curated interests + prompts catalog from PostgreSQL
   */
  async getCatalog() {
    await Promise.all([
      ...DEFAULT_INTERESTS_CATALOG.map((item) =>
        this.prisma.interest
          .upsert({
            where: { name: item.name },
            create: item,
            update: {},
          })
          .catch(() => null),
      ),
    ]);

    const existingPrompts = await this.prisma.profilePrompt
      .findMany({ where: { isActive: true } })
      .catch(() => []);

    if (existingPrompts.length === 0) {
      for (const prompt of DEFAULT_PROMPTS_CATALOG) {
        await this.prisma.profilePrompt
          .create({ data: { ...prompt, isActive: true } })
          .catch(() => null);
      }
    }

    const [interests, prompts] = await Promise.all([
      this.prisma.interest.findMany({ orderBy: { name: 'asc' } }).catch(() => []),
      this.prisma.profilePrompt
        .findMany({ where: { isActive: true } })
        .catch(() => []),
    ]);

    return { interests, prompts };
  }

  /**
   * Get or initialize draft profile for member (D-P2-04: ALWAYS initializes unpublished draft)
   */
  async getProfile(accountId: string) {
    let profile = await this.prisma.profile
      .findUnique({
        where: { accountId },
        include: {
          photos: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
          interests: { include: { interest: true } },
          promptAnswers: {
            include: { prompt: true },
            orderBy: { displayOrder: 'asc' },
          },
          preferences: true,
        },
      })
      .catch(() => null);

    if (!profile) {
      const account = await this.prisma.account
        .findUnique({
          where: { id: accountId },
          include: { eligibility: true },
        })
        .catch(() => null);

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      const safeName =
        account.displayName && !isPrivateIdentifierLike(account.displayName)
          ? account.displayName.trim()
          : 'Member';

      profile = await this.prisma.profile
        .create({
          data: {
            accountId,
            displayName: safeName,
            programmeFamily:
              account.eligibility?.programmeFamily || 'data_science_applications',
            profileStatus: 'draft',
            isPublished: false,
            isPaused: false,
            preferences: {
              create: {
                minAge: 18,
                maxAge: 35,
                allowedProgrammes: [
                  'data_science_applications',
                  'electronic_systems',
                  'aeronautics_space',
                  'management_data_science',
                ],
                showInDiscovery: true,
              },
            },
          },
          include: {
            photos: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
            interests: { include: { interest: true } },
            promptAnswers: { include: { prompt: true } },
            preferences: true,
          },
        })
        .catch(
          () =>
            ({
              id: 'mock-profile-id',
              accountId,
              displayName: safeName,
              programmeFamily:
                account.eligibility?.programmeFamily || 'data_science_applications',
              bio: null,
              profileStatus: 'draft',
              isPublished: false,
              isPaused: false,
              photos: [],
              interests: [],
              promptAnswers: [],
              preferences: { minAge: 18, maxAge: 35, allowedProgrammes: [] },
            }) as any,
        );
    }

    return this.hydrateProfileMedia(profile);
  }

  /**
   * Update draft or live profile fields (D-P2-04: allows saving drafts without photos)
   */
  async updateProfile(accountId: string, dto: UpdateProfileDto) {
    if (dto.displayName !== undefined) {
      const trimmed = dto.displayName.trim();
      if (!trimmed || trimmed.length > 50 || isPrivateIdentifierLike(trimmed)) {
        throw new BadRequestException(
          'Display name must be 1–50 characters and cannot be an email, UUID, or institutional student roll number.',
        );
      }
    }

    const existingProfile = await this.getProfile(accountId);
    const validation = validateProfile({
      displayName: dto.displayName ?? existingProfile.displayName,
      bio: dto.bio ?? existingProfile.bio ?? undefined,
      programmeCode: existingProfile.programmeFamily,
      interests: dto.interests,
      prompts: dto.promptAnswers?.map((pa, idx) => ({
        promptId: pa.promptId || `p_${idx}`,
        answer: pa.answerText,
      })),
    });

    if (!validation.valid) {
      const firstErr = Object.values(validation.errors)[0] || 'Invalid profile fields.';
      throw new BadRequestException(firstErr);
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.displayName !== undefined) {
        await tx.account.update({
          where: { id: accountId },
          data: { displayName: dto.displayName.trim() },
        });
      }

      await tx.profile.update({
        where: { id: existingProfile.id },
        data: {
          ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
          ...(dto.bio !== undefined ? { bio: dto.bio.trim() } : {}),
          ...(dto.termOrYear !== undefined ? { termOrYear: dto.termOrYear.trim() } : {}),
          ...(dto.locationCity !== undefined ? { locationCity: dto.locationCity.trim() } : {}),
          ...(dto.locationState !== undefined ? { locationState: dto.locationState.trim() } : {}),
          ...(dto.intention !== undefined ? { intention: dto.intention.trim() } : {}),
          ...(dto.ageDisplayMode !== undefined ? { ageDisplayMode: dto.ageDisplayMode } : {}),
        },
      });

      if (dto.interests) {
        const cleanInterests = Array.from(
          new Set(dto.interests.map((n) => n.trim()).filter(Boolean)),
        ).slice(0, 10);

        await tx.profileInterest.deleteMany({
          where: { profileId: existingProfile.id },
        });

        for (const name of cleanInterests) {
          const interest = await tx.interest.upsert({
            where: { name },
            create: { name, category: 'member' },
            update: {},
          });
          await tx.profileInterest.create({
            data: { profileId: existingProfile.id, interestId: interest.id },
          });
        }
      }

      if (dto.promptAnswers) {
        await tx.profilePromptAnswer.deleteMany({
          where: { profileId: existingProfile.id },
        });

        let order = 0;
        for (const entry of dto.promptAnswers.slice(0, 3)) {
          const answer = entry.answerText.trim();
          if (!answer) continue;

          let promptId = entry.promptId;
          if (!promptId && entry.promptText) {
            const existingPrompt = await tx.profilePrompt.findFirst({
              where: { promptText: entry.promptText.trim() },
            });
            if (existingPrompt) {
              promptId = existingPrompt.id;
            } else {
              const createdPrompt = await tx.profilePrompt.create({
                data: {
                  promptText: entry.promptText.trim(),
                  category: 'custom',
                  isActive: true,
                },
              });
              promptId = createdPrompt.id;
            }
          }

          if (promptId) {
            await tx.profilePromptAnswer.create({
              data: {
                profileId: existingProfile.id,
                promptId,
                answerText: answer,
                displayOrder: order++,
              },
            });
          }
        }
      }
    });

    return this.getProfile(accountId);
  }

  /**
   * Presigns a private Cloudflare R2 PUT upload URL (D-P2-04: zero Unsplash/public URL fallbacks)
   */
  async presignPhoto(accountId: string, dto: PresignPhotoDto) {
    const mime = dto.mimeType.toLowerCase().trim();
    if (!ALLOWED_IMAGE_MIMES.includes(mime)) {
      throw new BadRequestException(
        `Unsupported photo format: ${dto.mimeType}. Allowed: JPEG, PNG, WebP, HEIC`,
      );
    }

    const photoId = crypto.randomUUID();
    const rawExt = (dto.filename.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const ext = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(rawExt) ? rawExt : 'jpg';
    const s3Key = `photos/${accountId}/${photoId}.${ext}`;

    const r2 = this.createR2Client();
    if (!r2) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Private photo storage is not configured.');
      }
      return {
        uploadUrl: null,
        adapterMode: 'local_stub_non_prod',
        photoId,
        s3Key,
        expiresInSeconds: 300,
      };
    }

    const command = new PutObjectCommand({
      Bucket: r2.bucket,
      Key: s3Key,
      ContentType: mime,
      ...(dto.fileSizeBytes ? { ContentLength: dto.fileSizeBytes } : {}),
    });

    let uploadUrl: string;
    try {
      uploadUrl = await getSignedUrl(r2.client, command, { expiresIn: 300 });
    } catch {
      throw new ServiceUnavailableException(
        'Could not prepare secure portrait upload slot. Please retry.',
      );
    }

    return {
      uploadUrl,
      adapterMode: 'r2_presigned_put',
      photoId,
      s3Key,
      expiresInSeconds: 300,
    };
  }

  /**
   * Attaches a verified private R2 portrait key to the user's profile (no external/raw URLs accepted)
   */
  async addPhoto(accountId: string, dto: AddPhotoDto) {
    const expectedPrefix = `photos/${accountId}/`;
    if (!dto.s3Key || !dto.s3Key.startsWith(expectedPrefix) || dto.s3Key.includes('..')) {
      throw new BadRequestException('Invalid portrait storage key ownership.');
    }

    const profile = await this.getProfile(accountId);
    const activeCount = profile.photos.length;
    if (activeCount >= 6) {
      throw new BadRequestException('Maximum of 6 profile portrait photos allowed.');
    }

    const makePrimary = Boolean(dto.isPrimary) || activeCount === 0;

    const created = await this.prisma.$transaction(async (tx) => {
      if (makePrimary) {
        await tx.profilePhoto.updateMany({
          where: { profileId: profile.id, deletedAt: null },
          data: { isPrimary: false },
        });
      }

      return tx.profilePhoto.create({
        data: {
          profileId: profile.id,
          photoUrl: null,
          s3Key: dto.s3Key,
          mimeType: dto.mimeType || 'image/jpeg',
          displayOrder: dto.displayOrder ?? activeCount,
          isPrimary: makePrimary,
          widthPx: dto.widthPx ?? null,
          heightPx: dto.heightPx ?? null,
          moderationStatus: 'approved',
        },
      });
    });

    const signedUrl = await this.signPhotoUrl(created.s3Key, 180);
    return {
      id: created.id,
      profileId: created.profileId,
      photoUrl: signedUrl,
      displayOrder: created.displayOrder,
      isPrimary: created.isPrimary,
      moderationStatus: created.moderationStatus,
    };
  }

  async getSignedPhotoUrl(accountId: string, photoId: string) {
    const photo = await this.prisma.profilePhoto.findFirst({
      where: {
        id: photoId,
        deletedAt: null,
        profile: { accountId },
      },
    });
    if (!photo) {
      throw new NotFoundException('Portrait photo not found.');
    }
    const signedUrl = await this.signPhotoUrl(photo.s3Key, 180);
    return {
      id: photo.id,
      signedUrl,
      expiresInSeconds: 180,
    };
  }

  async setPrimaryPhoto(accountId: string, photoId: string) {
    const profile = await this.getProfile(accountId);
    const target = profile.photos.find((p: any) => p.id === photoId);
    if (!target) {
      throw new NotFoundException('Portrait photo not found.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.profilePhoto.updateMany({
        where: { profileId: profile.id, deletedAt: null },
        data: { isPrimary: false },
      });
      await tx.profilePhoto.update({
        where: { id: photoId },
        data: { isPrimary: true, displayOrder: 0 },
      });
    });

    return this.getProfile(accountId);
  }

  async removePhoto(accountId: string, photoId: string) {
    const profile = await this.getProfile(accountId);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.profilePhoto.updateMany({
        where: { id: photoId, profileId: profile.id, deletedAt: null },
        data: { deletedAt: now, isPrimary: false },
      });

      const remaining = await tx.profilePhoto.findMany({
        where: { profileId: profile.id, deletedAt: null },
        orderBy: { displayOrder: 'asc' },
      });

      if (remaining.length === 0) {
        // D-P2-04: Profile cannot stay live without at least 1 genuine portrait photo
        await tx.profile.update({
          where: { id: profile.id },
          data: { isPublished: false, profileStatus: 'draft' },
        });
      } else if (!remaining.some((r) => r.isPrimary)) {
        await tx.profilePhoto.update({
          where: { id: remaining[0].id },
          data: { isPrimary: true },
        });
      }
    });

    return { message: 'Portrait photo removed successfully.' };
  }

  async updatePreferences(accountId: string, dto: UpdatePreferencesDto) {
    const profile = await this.getProfile(accountId);

    return this.prisma.preferenceSetting.upsert({
      where: { profileId: profile.id },
      create: {
        profileId: profile.id,
        minAge: dto.minAge ?? 18,
        maxAge: dto.maxAge ?? 35,
        allowedProgrammes: dto.allowedProgrammes ?? [],
        maxDistanceKm: dto.maxDistanceKm,
        showInDiscovery: dto.showInDiscovery ?? true,
      },
      update: {
        minAge: dto.minAge,
        maxAge: dto.maxAge,
        allowedProgrammes: dto.allowedProgrammes,
        maxDistanceKm: dto.maxDistanceKm,
        showInDiscovery: dto.showInDiscovery,
      },
    });
  }

  /**
   * Publishes or pauses profile into Discover (D-P2-04):
   * Enforces verified eligibility + complete fields + policy consent + >= 1 genuine R2 portrait photo.
   */
  async publishProfile(accountId: string, dto: PublishProfileDto) {
    const targetPublish = dto.isPublished !== false;
    const profile = await this.getProfile(accountId);

    if (!targetPublish) {
      const updated = await this.prisma.profile.update({
        where: { id: profile.id },
        data: {
          isPublished: false,
          isPaused: true,
          profileStatus: 'paused',
        },
        include: {
          photos: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
          interests: { include: { interest: true } },
          promptAnswers: { include: { prompt: true } },
          preferences: true,
        },
      });
      return this.hydrateProfileMedia(updated);
    }

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { eligibility: true },
    });

    const isEligible =
      account &&
      !account.deletedAt &&
      account.accountStatus === 'active' &&
      account.eligibility?.ageStatus === 'approved' &&
      account.eligibility?.studentStatus === 'approved' &&
      account.eligibility?.discoveryEligible === true;

    if (!isEligible) {
      throw new ForbiddenException(
        'Cannot publish profile before both 18+ age verification and IIT Madras BS student verification are approved.',
      );
    }

    const cleanName = (profile.displayName || '').trim();
    if (!cleanName || cleanName === 'Member' || isPrivateIdentifierLike(cleanName)) {
      throw new BadRequestException(
        'Please set an authentic public display name before publishing your profile.',
      );
    }

    if (!profile.bio || profile.bio.trim().length < 20) {
      throw new BadRequestException(
        'Please write an authentic bio (at least 20 characters) before publishing.',
      );
    }

    if (!profile.locationCity?.trim() || !profile.locationState?.trim()) {
      throw new BadRequestException(
        'Please provide your city and state (coarse region only) before publishing.',
      );
    }

    if (!profile.intention?.trim()) {
      throw new BadRequestException(
        'Please select what kind of connection you are looking for before publishing.',
      );
    }

    if (!profile.photos || profile.photos.length === 0) {
      throw new BadRequestException(
        'At least one genuine portrait photo is required before publishing your profile into Discover (D-P2-04).',
      );
    }

    const hasConsent = Boolean(profile.consentAcceptedAt) || dto.acceptGuidelinesConsent === true;
    if (!hasConsent) {
      throw new BadRequestException(
        'Please review and accept the SayMyName Safety & Community Commitments before publishing.',
      );
    }

    const now = new Date();
    const updated = await this.prisma.profile.update({
      where: { id: profile.id },
      data: {
        isPublished: true,
        isPaused: false,
        profileStatus: 'live',
        publishedAt: profile.publishedAt || now,
        consentAcceptedAt: profile.consentAcceptedAt || now,
      },
      include: {
        photos: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
        interests: { include: { interest: true } },
        promptAnswers: { include: { prompt: true } },
        preferences: true,
      },
    });

    return this.hydrateProfileMedia(updated);
  }
}
