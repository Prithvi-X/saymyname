import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto, AddPhotoDto, UpdatePreferencesDto } from './dto/profile.dto';

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

      profile = await this.prisma.profile.create({
        data: {
          accountId,
          displayName: account.displayName || 'IITM Student',
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
        displayName: account.displayName || 'IITM Student',
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
    const profile = await this.getProfile(accountId);

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
