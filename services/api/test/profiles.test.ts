import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { ProfilesService } from '../src/modules/profiles/profiles.service';

describe('Profiles & Media Privacy Domain Tests (D-P2-04)', () => {
  function createMockPrisma(opts: { photos?: any[]; discoveryEligible?: boolean } = {}) {
    const state = {
      account: {
        id: 'acc-1',
        accountStatus: opts.discoveryEligible === false ? 'pending_verification' : 'active',
        deletedAt: null,
        displayName: 'Aarav',
        eligibility: {
          ageStatus: opts.discoveryEligible === false ? 'pending' : 'approved',
          studentStatus: opts.discoveryEligible === false ? 'pending' : 'approved',
          programmeFamily: 'data_science_applications',
          discoveryEligible: opts.discoveryEligible !== false,
        },
      },
      profile: null as any,
      photos: opts.photos || ([] as any[]),
    };

    const txClient: any = {
      account: {
        findUnique: async () => state.account,
        update: async (args: any) => Object.assign(state.account, args.data),
      },
      profile: {
        findUnique: async () =>
          state.profile
            ? { ...state.profile, photos: state.photos, interests: [], promptAnswers: [] }
            : null,
        create: async (args: any) => {
          state.profile = {
            id: 'prof-1',
            ...args.data,
            preferences: { minAge: 18, maxAge: 35, allowedProgrammes: [] },
            photos: state.photos,
            interests: [],
            promptAnswers: [],
          };
          return state.profile;
        },
        update: async (args: any) => {
          Object.assign(state.profile, args.data);
          return { ...state.profile, photos: state.photos, interests: [], promptAnswers: [] };
        },
      },
      profilePhoto: {
        updateMany: async () => ({ count: 0 }),
        create: async (args: any) => {
          const rec = { id: `photo-${state.photos.length + 1}`, deletedAt: null, createdAt: new Date(), ...args.data };
          state.photos.push(rec);
          return rec;
        },
        findMany: async () => state.photos.filter((p) => !p.deletedAt),
      },
      profileInterest: { deleteMany: async () => ({}), create: async () => ({}) },
      profilePromptAnswer: { deleteMany: async () => ({}), create: async () => ({}) },
      interest: { upsert: async ({ create }: any) => ({ id: 'int-1', ...create }) },
      profilePrompt: {
        findFirst: async () => null,
        create: async ({ data }: any) => ({ id: 'pr-1', ...data }),
        findMany: async () => [],
      },
    };

    return {
      ...txClient,
      state,
      $transaction: async (cb: any) => cb(txClient),
    };
  }

  test('Rule 1 (D-P2-04): New profile initializes strictly as draft (unpublished)', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);

    const profile = await service.getProfile('acc-1');
    assert.strictEqual(profile.isPublished, false);
    assert.strictEqual(profile.profileStatus, 'draft');
  });

  test('Rule 2 (D-P2-04): Draft can be saved without a photo, while publishing requires >= 1 genuine portrait photo', async () => {
    const prisma = createMockPrisma({ discoveryEligible: true });
    const service = new ProfilesService(prisma as any);

    await service.getProfile('acc-1');
    const draft = await service.updateProfile('acc-1', {
      displayName: 'Ananya',
      bio: 'Studying machine learning and classical music across distance.',
      locationCity: 'Bengaluru',
      locationState: 'Karnataka',
      intention: 'Meaningful relationship',
    });
    assert.strictEqual(draft.isPublished, false);

    // Publish without photo must fail with explicit requirement
    await assert.rejects(
      async () => service.publishProfile('acc-1', { isPublished: true, acceptGuidelinesConsent: true }),
      (err: any) => err.status === 400 && err.message.includes('At least one genuine portrait photo is required'),
    );

    // Reject foreign s3Key ownership
    await assert.rejects(
      async () => service.addPhoto('acc-1', { s3Key: 'photos/someone-else/p1.jpg' }),
      (err: any) => err.status === 400 && err.message.includes('Invalid portrait storage key'),
    );

    // Add genuine photo -> publish succeeds
    await service.addPhoto('acc-1', { s3Key: 'photos/acc-1/p1.jpg', mimeType: 'image/jpeg', isPrimary: true });
    const published = await service.publishProfile('acc-1', { isPublished: true, acceptGuidelinesConsent: true });
    assert.strictEqual(published.isPublished, true);
    assert.strictEqual(published.profileStatus, 'live');
  });

  test('Rule 3 (D-P2-04): Presign never returns Unsplash fallback URLs', async () => {
    const origId = process.env.R2_ACCOUNT_ID;
    const origEndpoint = process.env.R2_ENDPOINT;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ENDPOINT;

    try {
      const prisma = createMockPrisma();
      const service = new ProfilesService(prisma as any);
      const presigned = await service.presignPhoto('acc-1', {
        filename: 'portrait.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 50000,
      });
      assert.strictEqual(presigned.s3Key.startsWith('photos/acc-1/'), true);
      assert.strictEqual(JSON.stringify(presigned).includes('unsplash'), false);
      assert.strictEqual(JSON.stringify(presigned).includes('media.saymyname.in'), false);
    } finally {
      if (origId !== undefined) process.env.R2_ACCOUNT_ID = origId;
      if (origEndpoint !== undefined) process.env.R2_ENDPOINT = origEndpoint;
    }
  });
});
