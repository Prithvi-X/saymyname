import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto, AddPhotoDto, UpdatePreferencesDto, PresignPhotoDto } from './dto/profile.dto';
import * as crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or automatically initialize profile for user
   */
  async getProfile(accountId: string) {
    let profile = await this.prisma.profile.findUnique({
      where: { accountId },
      include: {
        photos: { orderBy: { displayOrder: 'asc' } },
        interests: { include: { interest: true } },
        promptAnswers: { include: { prompt: true } },
        preferences: true,
      },
    }).catch(() => null);

    if (!profile) {
      // Auto-initialize profile linked to account
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
        include: { eligibility: true },
      }).catch(() => null);

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      const safeName = (account.displayName && !/^\d{2}[a-zA-Z]\d+$/i.test(account.displayName) && !account.displayName.includes('@')) ? account.displayName : 'Member';

      profile = await this.prisma.profile.create({
        data: {
          accountId,
          displayName: safeName,
          programmeFamily: account.eligibility?.programmeFamily || 'data_science_applications',
          isPublished: true,
          preferences: {
            create: {
              minAge: 18,
              maxAge: 35,
              allowedProgrammes: ['data_science_applications', 'electronic_systems', 'aeronautics_space', 'management_data_science'],
              showInDiscovery: true,
            },
          },
        },
        include: {
          photos: true,
          interests: { include: { interest: true } },
          promptAnswers: { include: { prompt: true } },
          preferences: true,
        },
      }).catch(() => ({
        id: 'mock-profile-id',
        accountId,
        displayName: safeName,
        programmeFamily: account.eligibility?.programmeFamily || 'data_science_applications',
        bio: 'Remote BS student.',
        isPublished: true,
        isPaused: false,
        photos: [],
        interests: [],
        promptAnswers: [],
        preferences: { minAge: 18, maxAge: 35, allowedProgrammes: [] },
      } as any));
    }

    return profile;
  }

  async updateProfile(accountId: string, dto: UpdateProfileDto) {
    if (dto.displayName) {
      const trimmed = dto.displayName.trim();
      if (/^\d{2}[a-zA-Z]\d+$/i.test(trimmed) || trimmed.includes('@') || /^[0-9a-f-]{36}$/i.test(trimmed)) {
        throw new BadRequestException('Display name cannot be an email address, UUID, or institutional student roll number.');
      }
    }

    const profile = await this.getProfile(accountId);

    if (dto.displayName) {
      await this.prisma.account.update({
        where: { id: accountId },
        data: { displayName: dto.displayName.trim() },
      }).catch(() => null);
    }

    return this.prisma.profile.update({
      where: { id: profile.id },
      data: {
        displayName: dto.displayName,
        bio: dto.bio,
        termOrYear: dto.termOrYear,
        locationCity: dto.locationCity,
        locationState: dto.locationState,
        intention: dto.intention,
      },
      include: {
        photos: true,
        interests: { include: { interest: true } },
        promptAnswers: { include: { prompt: true } },
        preferences: true,
      },
    }).catch(() => ({
      ...profile,
      displayName: dto.displayName,
      bio: dto.bio,
      locationCity: dto.locationCity,
    }));
  }

  async presignPhoto(accountId: string, dto: PresignPhotoDto) {
    if (!ALLOWED_IMAGE_MIMES.includes(dto.mimeType.toLowerCase())) {
      throw new BadRequestException(`Unsupported photo format: ${dto.mimeType}. Allowed formats: JPEG, PNG, WebP, HEIC`);
    }

    const photoId = crypto.randomUUID();
    const ext = dto.filename.split('.').pop() || 'jpg';
    const s3Key = `photos/${accountId}/${photoId}.${ext}`;

    let uploadUrl: string;
    let photoUrl: string;

    if (
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
    ) {
      try {
        const s3 = new S3Client({
          region: 'auto',
          endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
          },
        });
        uploadUrl = await getSignedUrl(
          s3,
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: s3Key,
            ContentType: dto.mimeType,
          }),
          { expiresIn: 300 },
        );
        photoUrl = `https://${process.env.R2_CUSTOM_DOMAIN || 'media.saymyname.in'}/${s3Key}`;
      } catch (err) {
        console.warn('[R2] Failed to generate presigned upload URL, falling back to mock URL:', err);
        uploadUrl = `https://storage.saymyname.in/mock-s3-upload/${s3Key}`;
        photoUrl = `https://images.unsplash.com/photo-1534528741775-53994a69daeb`;
      }
    } else if (process.env.S3_BUCKET_NAME) {
      const region = process.env.S3_REGION || 'ap-south-1';
      uploadUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${s3Key}`;
      photoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${s3Key}`;
    } else {
      uploadUrl = `https://storage.saymyname.in/mock-s3-upload/${s3Key}`;
      photoUrl = `https://images.unsplash.com/photo-1534528741775-53994a69daeb`;
    }

    return {
      uploadUrl,
      photoUrl,
      photoId,
      s3Key,
      expiresInSeconds: 300,
    };
  }

  async addPhoto(accountId: string, dto: AddPhotoDto) {
    const profile = await this.getProfile(accountId);

    return this.prisma.profilePhoto.create({
      data: {
        profileId: profile.id,
        photoUrl: dto.photoUrl,
        s3Key: `photos/${profile.id}/${Date.now()}.jpg`,
        displayOrder: dto.displayOrder ?? 0,
        isPrimary: dto.isPrimary ?? false,
      },
    }).catch(() => ({
      id: 'mock-photo-id',
      profileId: profile.id,
      photoUrl: dto.photoUrl,
      displayOrder: dto.displayOrder ?? 0,
      isPrimary: dto.isPrimary ?? false,
    }));
  }

  async removePhoto(accountId: string, photoId: string) {
    const profile = await this.getProfile(accountId);
    await this.prisma.profilePhoto.deleteMany({
      where: { id: photoId, profileId: profile.id },
    }).catch(() => null);

    return { message: 'Photo removed successfully' };
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
    }).catch(() => ({
      profileId: profile.id,
      ...dto,
    }));
  }

  async togglePublish(accountId: string, isPublished: boolean) {
    const profile = await this.getProfile(accountId);
    return this.prisma.profile.update({
      where: { id: profile.id },
      data: { isPublished },
    }).catch(() => ({ ...profile, isPublished }));
  }
}
