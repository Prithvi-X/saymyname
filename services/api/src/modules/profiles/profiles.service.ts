import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { calculateAgeYears, isPrivateIdentifierLike, validateProfile } from '@saymyname/validation';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpdateProfileDto,
  AddPhotoDto,
  UpdatePreferencesDto,
  PresignPhotoDto,
  PublishProfileDto,
} from './dto/profile.dto';
import {
  getAllowedImageMimes,
  isHeicDecodingSupported,
  ImageValidationResult,
  MAX_PHOTO_BYTES,
  readLimitedS3Body,
  validateImageBinary,
  verifyAndSanitizeR2Image,
} from './image-security';

export { ImageValidationResult, validateImageBinary };

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

    let isCloudflareR2Host = false;
    try {
      isCloudflareR2Host = /(?:^|\.)r2\.cloudflarestorage\.com$/i.test(new URL(endpoint).hostname);
    } catch {
      isCloudflareR2Host = false;
    }
    const forcePathStyle = !isCloudflareR2Host && process.env.R2_FORCE_PATH_STYLE === 'true';

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
          s3Key: p.s3Key,
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

    return {
      interests,
      prompts,
      supportedImageMimes: [...getAllowedImageMimes()],
      heicSupported: isHeicDecodingSupported(),
    };
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
    const allowedMimes = getAllowedImageMimes();
    if (!allowedMimes.includes(mime)) {
      const labels = allowedMimes
        .map((m) => m.replace('image/', '').toUpperCase())
        .join(', ');
      throw new BadRequestException(
        `Unsupported photo format: ${dto.mimeType}. Allowed in current runtime: ${labels}`,
      );
    }

    if (dto.fileSizeBytes && dto.fileSizeBytes > 10 * 1024 * 1024) {
      throw new BadRequestException('Photo file size exceeds maximum limit of 10 MB.');
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
    if (dto.mimeType) {
      const normalizedMime = dto.mimeType.toLowerCase().trim();
      const allowedMimes = getAllowedImageMimes();
      if (!allowedMimes.includes(normalizedMime)) {
        const labels = allowedMimes
          .map((m) => m.replace('image/', '').toUpperCase())
          .join(', ');
        throw new BadRequestException(
          `Unsupported photo format: ${dto.mimeType}. Allowed in current runtime: ${labels}`,
        );
      }
    }

    const expectedPrefix = `photos/${accountId}/`;
    if (!dto.s3Key || !dto.s3Key.startsWith(expectedPrefix) || dto.s3Key.includes('..')) {
      throw new BadRequestException('Invalid portrait storage key ownership.');
    }

    if (dto.fileSizeBytes && dto.fileSizeBytes > 10 * 1024 * 1024) {
      throw new BadRequestException('Photo file size exceeds maximum limit of 10 MB.');
    }

    const profile = await this.getProfile(accountId);
    if ((profile.photos || []).some((p: any) => p.s3Key === dto.s3Key)) {
      throw new BadRequestException('This photograph has already been attached to your profile.');
    }

    const activeCount = profile.photos.length;
    if (activeCount >= 6) {
      throw new BadRequestException('Maximum of 6 profile portrait photos allowed.');
    }

    let verifiedMime = dto.mimeType || 'image/jpeg';
    let verifiedWidth: number | null = dto.widthPx ?? null;
    let verifiedHeight: number | null = dto.heightPx ?? null;

    // When R2 client is active, fetch uploaded binary from private storage, validate magic bytes + image decode, strip metadata/EXIF, and overwrite safely
    const r2 = this.createR2Client();
    if (r2) {
      let rawBuffer: Buffer;
      let objectMime: string | undefined;
      try {
        const obj = await r2.client.send(
          new GetObjectCommand({ Bucket: r2.bucket, Key: dto.s3Key }),
        );
        objectMime = obj.ContentType;
        if (obj.ContentLength && obj.ContentLength > MAX_PHOTO_BYTES) {
          await r2.client
            .send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: dto.s3Key }))
            .catch(() => null);
          throw new BadRequestException('Uploaded object exceeds maximum size of 10 MB.');
        }
        rawBuffer = await readLimitedS3Body(obj.Body, MAX_PHOTO_BYTES);
      } catch (err: any) {
        if (err instanceof BadRequestException) {
          await r2.client
            .send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: dto.s3Key }))
            .catch(() => null);
          throw err;
        }
        throw new NotFoundException('Uploaded photograph object not found in private storage.');
      }

      try {
        const sanitized = await verifyAndSanitizeR2Image(
          rawBuffer,
          dto.mimeType || objectMime,
        );
        verifiedMime = sanitized.detectedMime;
        verifiedWidth = sanitized.widthPx ?? verifiedWidth;
        verifiedHeight = sanitized.heightPx ?? verifiedHeight;

        if (sanitized.sanitizedBuffer) {
          await r2.client.send(
            new PutObjectCommand({
              Bucket: r2.bucket,
              Key: dto.s3Key,
              Body: sanitized.sanitizedBuffer,
              ContentType: sanitized.detectedMime,
              Metadata: { sanitized: 'true' },
            }),
          );
        }
      } catch (err: any) {
        await r2.client
          .send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: dto.s3Key }))
          .catch(() => null);
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException(
          'Uploaded photograph failed server image verification and was removed.',
        );
      }
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
          mimeType: verifiedMime,
          displayOrder: dto.displayOrder ?? activeCount,
          isPrimary: makePrimary,
          widthPx: verifiedWidth,
          heightPx: verifiedHeight,
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
      } else {
        const primaries = remaining.filter((r) => r.isPrimary);
        if (primaries.length === 0) {
          await tx.profilePhoto.update({
            where: { id: remaining[0].id },
            data: { isPrimary: true },
          });
        } else if (primaries.length > 1) {
          for (let i = 1; i < primaries.length; i++) {
            await tx.profilePhoto.update({
              where: { id: primaries[i].id },
              data: { isPrimary: false },
            });
          }
        }
      }
    });

    return { message: 'Portrait photo removed successfully.' };
  }

  async reorderPhotos(accountId: string, photoIds: string[]) {
    const profile = await this.getProfile(accountId);
    const existingPhotos = profile.photos || [];
    const existingIds = new Set(existingPhotos.map((p: any) => p.id));

    // Validate all provided photo IDs belong to this profile
    for (const id of photoIds) {
      if (!existingIds.has(id)) {
        throw new ForbiddenException('Cannot reorder photographs belonging to another account.');
      }
    }

    await this.prisma.$transaction(async (tx: any) => {
      for (let index = 0; index < photoIds.length; index++) {
        await tx.profilePhoto.update({
          where: { id: photoIds[index] },
          data: {
            displayOrder: index,
            isPrimary: index === 0,
          },
        });
      }
    });

    return this.getProfile(accountId);
  }

  async getPreferences(accountId: string) {
    const profile = await this.getProfile(accountId);
    const prefs = await this.prisma.preferenceSetting.findUnique({
      where: { profileId: profile.id },
    });
    if (!prefs) {
      return {
        minAge: 18,
        maxAge: 35,
        allowedProgrammes: [
          'data_science_applications',
          'electronic_systems',
          'aeronautics_space',
          'management_data_science',
        ],
        maxDistanceKm: null,
        showInDiscovery: true,
      };
    }
    return prefs;
  }

  async updatePreferences(accountId: string, dto: UpdatePreferencesDto) {
    if (dto.minAge !== undefined && dto.minAge < 18) {
      throw new BadRequestException('Minimum age preference must be at least 18+ (Phase 1 adult restriction).');
    }
    if (dto.maxAge !== undefined && dto.maxAge > 65) {
      throw new BadRequestException('Maximum age preference cannot exceed 65.');
    }
    if (dto.minAge !== undefined && dto.maxAge !== undefined && dto.minAge > dto.maxAge) {
      throw new BadRequestException('Minimum age cannot be greater than maximum age.');
    }
    if (dto.allowedProgrammes && Array.isArray(dto.allowedProgrammes)) {
      const APPROVED_PROGRAMMES = [
        'data_science_applications',
        'electronic_systems',
        'aeronautics_space',
        'management_data_science',
      ];
      for (const prog of dto.allowedProgrammes) {
        if (!APPROVED_PROGRAMMES.includes(prog)) {
          throw new BadRequestException(`Unrecognised academic programme in preferences: ${prog}`);
        }
      }
    }

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

  async getPreviewProfile(accountId: string) {
    const profile = await this.getProfile(accountId);
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { eligibility: true },
    });

    let calculatedAge: number | null = null;
    const rawDob = (account as any)?.eligibility?.dateOfBirth ?? (account as any)?.dateOfBirth;
    if (rawDob && profile.ageDisplayMode !== 'hidden') {
      const normalizedDob =
        typeof rawDob === 'string' && rawDob.includes('T') ? new Date(rawDob) : rawDob;
      calculatedAge = calculateAgeYears(normalizedDob);
    }

    return {
      id: profile.id,
      displayName: profile.displayName,
      age: calculatedAge,
      programmeFamily: profile.programmeFamily,
      termOrYear: profile.termOrYear,
      locationCity: profile.locationCity,
      locationState: profile.locationState,
      intention: profile.intention,
      bio: profile.bio,
      photos: (profile.photos || []).map((p: any) => ({
        id: p.id,
        photoUrl: p.photoUrl,
        displayOrder: p.displayOrder,
        isPrimary: p.isPrimary,
      })),
      interests: (profile.interests || []).map((i: any) => i.name || i.interest?.name).filter(Boolean),
      promptAnswers: (profile.promptAnswers || []).map((pa: any) => ({
        id: pa.id,
        promptId: pa.promptId,
        promptText: pa.promptText || pa.prompt?.promptText || '',
        answerText: pa.answerText,
      })),
      isVerified: Boolean(
        account?.eligibility?.ageStatus === 'approved' &&
          account?.eligibility?.studentStatus === 'approved',
      ),
    };
  }

  async getPublicProfile(viewerAccountId: string, targetProfileId: string) {
    const targetProfile = await this.prisma.profile.findUnique({
      where: { id: targetProfileId },
      include: {
        account: { include: { eligibility: true } },
        photos: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
        interests: { include: { interest: true } },
        promptAnswers: { include: { prompt: true } },
      },
    });

    const targetAccount = targetProfile?.account as any;
    const targetElig = targetAccount?.eligibility;
    const isTargetEligible =
      !targetAccount ||
      (!targetAccount.deletedAt &&
        targetAccount.accountStatus === 'active' &&
        (!targetElig ||
          (targetElig.ageStatus === 'approved' &&
            targetElig.studentStatus === 'approved' &&
            targetElig.discoveryEligible === true &&
            (!targetElig.validUntil || new Date(targetElig.validUntil) > new Date()))));

    if (
      !targetProfile ||
      !isTargetEligible ||
      !targetProfile.isPublished ||
      targetProfile.isPaused ||
      targetProfile.profileStatus !== 'live'
    ) {
      throw new NotFoundException('Profile not found or unavailable.');
    }

    const block = await (this.prisma as any).userBlock.findFirst({
      where: {
        OR: [
          { blockerId: viewerAccountId, blockedId: targetProfile.accountId },
          { blockerId: targetProfile.accountId, blockedId: viewerAccountId },
        ],
      },
    });

    if (block) {
      throw new NotFoundException('Profile not found or unavailable.');
    }

    const hydrated = await this.hydrateProfileMedia(targetProfile);

    let calculatedAge: number | null = null;
    const targetDob =
      (targetProfile.account as any)?.eligibility?.dateOfBirth ??
      (targetProfile.account as any)?.dateOfBirth;
    if (targetDob && targetProfile.ageDisplayMode !== 'hidden') {
      const normalizedDob =
        typeof targetDob === 'string' && targetDob.includes('T') ? new Date(targetDob) : targetDob;
      calculatedAge = calculateAgeYears(normalizedDob);
    }

    return {
      id: hydrated.id,
      displayName: hydrated.displayName,
      age: calculatedAge,
      programmeFamily: hydrated.programmeFamily,
      termOrYear: hydrated.termOrYear,
      locationCity: hydrated.locationCity,
      locationState: hydrated.locationState,
      intention: hydrated.intention,
      bio: hydrated.bio,
      photos: (hydrated.photos || []).map((p: any) => ({
        id: p.id,
        photoUrl: p.photoUrl,
        displayOrder: p.displayOrder,
        isPrimary: p.isPrimary,
      })),
      interests: (hydrated.interests || []).map((i: any) => i.name || i.interest?.name).filter(Boolean),
      promptAnswers: (hydrated.promptAnswers || []).map((pa: any) => ({
        id: pa.id,
        promptId: pa.promptId,
        promptText: pa.promptText || pa.prompt?.promptText || '',
        answerText: pa.answerText,
      })),
      isVerified: Boolean(
        targetProfile.account?.eligibility?.ageStatus === 'approved' &&
          targetProfile.account?.eligibility?.studentStatus === 'approved',
      ),
    };
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

    // Require at least one successfully validated, attached and ready photograph in private R2
    const readyPhotos = (profile.photos || []).filter(
      (p: any) => !p.deletedAt && p.moderationStatus === 'approved' && p.s3Key,
    );
    if (readyPhotos.length === 0) {
      throw new BadRequestException(
        'At least one genuine portrait photo is required before publishing your profile into Discover (D-P2-04).',
      );
    }

    // Ensure exactly one primary photograph exists when photos are present
    const primaries = readyPhotos.filter((p: any) => p.isPrimary);
    if (primaries.length === 0) {
      await this.prisma.profilePhoto.update({
        where: { id: readyPhotos[0].id },
        data: { isPrimary: true },
      });
      readyPhotos[0].isPrimary = true;
    } else if (primaries.length > 1) {
      for (let i = 1; i < primaries.length; i++) {
        await this.prisma.profilePhoto.update({
          where: { id: primaries[i].id },
          data: { isPrimary: false },
        });
        primaries[i].isPrimary = false;
      }
    }

    // Durable consent tracking: member identity, acceptance timestamp, consent version
    const isNewConsent = !profile.consentAcceptedAt && dto.acceptGuidelinesConsent === true;
    const consentAcceptedAt = profile.consentAcceptedAt || (dto.acceptGuidelinesConsent ? new Date() : null);

    if (!consentAcceptedAt) {
      throw new BadRequestException(
        'Please review and accept the SayMyName Safety & Community Commitments before publishing.',
      );
    }

    const consentVersion = dto.consentVersion || 'v1.0';

    if (isNewConsent) {
      try {
        if ((this.prisma as any).auditEvent?.create) {
          await (this.prisma as any).auditEvent.create({
            data: {
              actorId: accountId,
              action: 'guidelines_consent_accepted',
              resourceType: 'profile',
              resourceId: profile.id,
              metadata: {
                consentVersion,
                acceptedAt: consentAcceptedAt.toISOString(),
                memberId: accountId,
              },
            },
          });
        }
      } catch {
        // Resilient audit event recording
      }
    }

    const now = new Date();
    const updated = await this.prisma.profile.update({
      where: { id: profile.id },
      data: {
        isPublished: true,
        isPaused: false,
        profileStatus: 'live',
        publishedAt: profile.publishedAt || now,
        consentAcceptedAt,
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
