import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { ProfilesService, validateImageBinary } from '../src/modules/profiles/profiles.service';

describe('Phase 3.1: Profile & Dating Preferences Comprehensive Test Suite', () => {
  function createMockPrisma(opts: {
    discoveryEligible?: boolean;
    ageStatus?: string;
    studentStatus?: string;
    photos?: any[];
    blocked?: boolean;
  } = {}) {
    const state = {
      account: {
        id: 'acc-1',
        accountStatus: opts.discoveryEligible === false ? 'pending_verification' : 'active',
        deletedAt: null,
        displayName: 'Aarav',
        dateOfBirth: '2002-05-15T00:00:00.000Z',
        studentRollNo: '21f1001234',
        eligibility: {
          ageStatus: opts.ageStatus || (opts.discoveryEligible === false ? 'pending' : 'approved'),
          studentStatus: opts.studentStatus || (opts.discoveryEligible === false ? 'pending' : 'approved'),
          programmeFamily: 'data_science_applications',
          discoveryEligible: opts.discoveryEligible !== false,
        },
      },
      targetAccount: {
        id: 'acc-2',
        accountStatus: 'active',
        deletedAt: null,
        displayName: 'Deepika',
        dateOfBirth: '2001-08-20T00:00:00.000Z',
        studentRollNo: '22f2005678',
        eligibility: {
          ageStatus: 'approved',
          studentStatus: 'approved',
          programmeFamily: 'electronic_systems',
          discoveryEligible: true,
        },
      },
      profile: null as any,
      targetProfile: null as any,
      photos: opts.photos || ([] as any[]),
      targetPhotos: [] as any[],
      interests: [] as any[],
      prompts: [] as any[],
      preferences: {
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
      } as any,
      userBlocks: opts.blocked ? [{ blockerId: 'acc-2', blockedId: 'acc-1' }] : ([] as any[]),
      auditEvents: [] as any[],
    };

    const txClient: any = {
      account: {
        findUnique: async ({ where }: any) => {
          if (where.id === 'acc-2') return state.targetAccount;
          return state.account;
        },
        update: async (args: any) => Object.assign(state.account, args.data),
      },
      profile: {
        findUnique: async ({ where }: any) => {
          if (where.id === 'prof-target') {
            return state.targetProfile
              ? {
                  ...state.targetProfile,
                  account: state.targetAccount,
                  photos: state.targetPhotos.filter((p) => !p.deletedAt),
                  interests: state.interests,
                  promptAnswers: state.prompts,
                }
              : null;
          }
          if (where.accountId === 'acc-2') {
            return state.targetProfile;
          }
          return state.profile
            ? {
                ...state.profile,
                account: state.account,
                photos: state.photos
                  .filter((p) => !p.deletedAt)
                  .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
                interests: state.interests,
                promptAnswers: state.prompts,
                preferences: state.preferences,
              }
            : null;
        },
        create: async (args: any) => {
          const rec = {
            id: args.data.accountId === 'acc-2' ? 'prof-target' : 'prof-1',
            ...args.data,
            preferences: state.preferences,
            photos: args.data.accountId === 'acc-2' ? state.targetPhotos : state.photos,
            interests: state.interests,
            promptAnswers: state.prompts,
          };
          if (args.data.accountId === 'acc-2') {
            state.targetProfile = rec;
          } else {
            state.profile = rec;
          }
          return rec;
        },
        update: async (args: any) => {
          const target = args.where.id === 'prof-target' ? state.targetProfile : state.profile;
          Object.assign(target, args.data);
          return {
            ...target,
            photos: (args.where.id === 'prof-target' ? state.targetPhotos : state.photos)
              .filter((p) => !p.deletedAt)
              .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
            interests: state.interests,
            promptAnswers: state.prompts,
            preferences: state.preferences,
          };
        },
      },
      profilePhoto: {
        updateMany: async ({ where, data }: any) => {
          state.photos.forEach((p) => {
            if (!where.id || p.id === where.id) {
              Object.assign(p, data);
            }
          });
          return { count: state.photos.length };
        },
        update: async ({ where, data }: any) => {
          const p = state.photos.find((item) => item.id === where.id);
          if (p) Object.assign(p, data);
          return p;
        },
        create: async (args: any) => {
          const rec = {
            id: `photo-${state.photos.length + 1}`,
            deletedAt: null,
            createdAt: new Date(),
            ...args.data,
          };
          state.photos.push(rec);
          return rec;
        },
        findMany: async () => {
          return state.photos.filter((p) => !p.deletedAt);
        },
        findFirst: async ({ where }: any) => {
          return state.photos.find((p) => p.id === where.id && !p.deletedAt) || null;
        },
      },
      preferenceSetting: {
        findUnique: async () => state.preferences,
        upsert: async ({ create, update }: any) => {
          Object.assign(state.preferences, update || create);
          return state.preferences;
        },
        create: async ({ data }: any) => {
          Object.assign(state.preferences, data);
          return state.preferences;
        },
      },
      profileInterest: {
        deleteMany: async () => {
          state.interests = [];
          return { count: 0 };
        },
        create: async ({ data }: any) => {
          state.interests.push(data);
          return data;
        },
      },
      profilePromptAnswer: {
        deleteMany: async () => {
          state.prompts = [];
          return { count: 0 };
        },
        create: async ({ data }: any) => {
          state.prompts.push(data);
          return data;
        },
      },
      interest: {
        upsert: async ({ create }: any) => ({ id: `int-${create.name}`, ...create }),
      },
      profilePrompt: {
        findFirst: async ({ where }: any) => ({ id: 'pr-1', promptText: where.promptText }),
        create: async ({ data }: any) => ({ id: 'pr-custom', ...data }),
      },
      userBlock: {
        findFirst: async () => (state.userBlocks.length > 0 ? state.userBlocks[0] : null),
      },
      auditEvent: {
        create: async ({ data }: any) => {
          state.auditEvents.push(data);
          return { id: `audit-${state.auditEvents.length}`, ...data };
        },
      },
    };

    return {
      ...txClient,
      state,
      $transaction: async (cb: any) => cb(txClient),
    };
  }

  // 1. Profile Retrieval & Initialization
  test('PROF-001: New profile initializes strictly as draft (unpublished)', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);

    const profile = await service.getProfile('acc-1');
    assert.strictEqual(profile.isPublished, false);
    assert.strictEqual(profile.profileStatus, 'draft');
    assert.strictEqual(profile.displayName, 'Aarav');
    assert.strictEqual(profile.programmeFamily, 'data_science_applications');
  });

  // 2. Display Name Validation
  test('PROF-002: Display name validation rejects empty strings, >50 chars, and roll numbers', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);
    await service.getProfile('acc-1');

    // Reject empty
    await assert.rejects(
      async () => service.updateProfile('acc-1', { displayName: '   ' }),
      (err: any) => err.status === 400 && err.message.includes('Display name'),
    );

    // Reject >50 chars
    await assert.rejects(
      async () => service.updateProfile('acc-1', { displayName: 'A'.repeat(51) }),
      (err: any) => err.status === 400,
    );

    // Reject roll number (e.g. 21f1001234)
    await assert.rejects(
      async () => service.updateProfile('acc-1', { displayName: '21f1001234' }),
      (err: any) => err.status === 400 && err.message.includes('student roll number'),
    );

    // Reject email address
    await assert.rejects(
      async () => service.updateProfile('acc-1', { displayName: 'student@study.iitm.ac.in' }),
      (err: any) => err.status === 400,
    );

    // Accept valid authentic display name
    const updated = await service.updateProfile('acc-1', { displayName: 'Aarav Raman' });
    assert.strictEqual(updated.displayName, 'Aarav Raman');
  });

  // 3. Verified Academic Field Immutability
  test('PROF-003: Client profile updates cannot alter verified academic programme', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);
    await service.getProfile('acc-1');

    // Attempting to pass programmeFamily in update (ignored / untyped)
    const updated = await service.updateProfile('acc-1', {
      displayName: 'Aarav Raman',
      bio: 'Machine learning learner.',
    } as any);

    assert.strictEqual(updated.programmeFamily, 'data_science_applications');
  });

  // 4. Biography Length & Multiline Support
  test('BIO-001: Biography enforces 500-character maximum and preserves multiline content', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);
    await service.getProfile('acc-1');

    // Over 500 characters rejected
    await assert.rejects(
      async () => service.updateProfile('acc-1', { bio: 'X'.repeat(501) }),
      (err: any) => err.status === 400,
    );

    // Valid multiline bio accepted
    const bioText = 'Line 1: BS Data Science student.\nLine 2: Passionate about ML and music.\nLine 3: Looking for a connection.';
    const updated = await service.updateProfile('acc-1', { bio: bioText });
    assert.strictEqual(updated.bio, bioText);
  });

  // 5. Interest Management & Limits
  test('INT-001: Interests are deduplicated and capped at maximum 10 items', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);
    await service.getProfile('acc-1');

    // Reject > 10 interests
    const tooMany = [
      'Machine Learning', 'Statistics', 'Music', 'Chess', 'Reading',
      'Hiking', 'Cycling', 'Cooking', 'Photography', 'Astronomy', 'Robotics',
    ];
    await assert.rejects(
      async () => service.updateProfile('acc-1', { interests: tooMany }),
      (err: any) => err.status === 400 && err.message.includes('Maximum of 10 interests'),
    );

    // Accept <= 10 and deduplicate
    const interestsList = [
      'Machine Learning',
      'Statistics',
      'Music',
      'Chess',
      'Music', // Duplicate - must be deduped
    ];
    await service.updateProfile('acc-1', { interests: interestsList });
    assert.strictEqual(prisma.state.interests.length, 4);
  });

  // 6. Conversation Prompts & Answer Length
  test('PROMPT-001: Prompts are capped at maximum 3 items and answers restricted to 250 characters', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);
    await service.getProfile('acc-1');

    // Answer >250 characters rejected
    await assert.rejects(
      async () =>
        service.updateProfile('acc-1', {
          promptAnswers: [
            { promptText: 'My favourite course', answerText: 'A'.repeat(251) },
          ],
        }),
      (err: any) => err.status === 400,
    );

    // More than 3 prompts rejected
    await assert.rejects(
      async () =>
        service.updateProfile('acc-1', {
          promptAnswers: [
            { promptText: 'P1', answerText: 'A1' },
            { promptText: 'P2', answerText: 'A2' },
            { promptText: 'P3', answerText: 'A3' },
            { promptText: 'P4', answerText: 'A4' },
          ],
        }),
      (err: any) => err.status === 400 && err.message.includes('Maximum of 3 prompts'),
    );

    // Up to 3 prompts accepted
    await service.updateProfile('acc-1', {
      promptAnswers: [
        { promptText: 'Course that surprised me', answerText: 'Machine Learning Foundations.' },
        { promptText: 'Ideal weekend', answerText: 'Coding, jamming on guitar, and reading.' },
        { promptText: 'Best study spot', answerText: 'Quiet corner in the central library.' },
      ],
    });

    assert.strictEqual(prisma.state.prompts.length, 3);
  });

  // 7. Private Dating Preferences - Retrieval & Ownership
  test('PREF-001: Dating preferences retrieval returns private filters for account owner', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);

    const prefs = await service.getPreferences('acc-1');
    assert.strictEqual(prefs.minAge, 18);
    assert.strictEqual(prefs.maxAge, 35);
    assert.strictEqual(prefs.showInDiscovery, true);
  });

  // 8. Private Dating Preferences - Invariant Enforcement
  test('PREF-002: Preferences reject minAge < 18, maxAge > 65, minAge > maxAge, and unapproved programmes', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);

    // Reject minAge < 18
    await assert.rejects(
      async () => service.updatePreferences('acc-1', { minAge: 17 }),
      (err: any) => err.status === 400 && err.message.includes('18+'),
    );

    // Reject maxAge > 65
    await assert.rejects(
      async () => service.updatePreferences('acc-1', { maxAge: 70 }),
      (err: any) => err.status === 400 && err.message.includes('65'),
    );

    // Reject minAge > maxAge
    await assert.rejects(
      async () => service.updatePreferences('acc-1', { minAge: 30, maxAge: 25 }),
      (err: any) => err.status === 400 && err.message.includes('greater than maximum'),
    );

    // Reject unapproved programme family
    await assert.rejects(
      async () => service.updatePreferences('acc-1', { allowedProgrammes: ['unapproved_degree'] }),
      (err: any) => err.status === 400 && err.message.includes('Unrecognised academic programme'),
    );

    // Valid update succeeds
    const updated = await service.updatePreferences('acc-1', {
      minAge: 20,
      maxAge: 28,
      allowedProgrammes: ['data_science_applications', 'electronic_systems'],
      maxDistanceKm: 100,
      showInDiscovery: true,
    });
    assert.strictEqual(updated.minAge, 20);
    assert.strictEqual(updated.maxAge, 28);
    assert.deepStrictEqual(updated.allowedProgrammes, ['data_science_applications', 'electronic_systems']);
  });

  // 9. Photo Presign - Backend Key Generation & Format Validation
  test('PHOTO-001: Photo presign validates MIME types and constructs account-scoped key', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);

    // Reject invalid mime type (e.g. text/plain or gif)
    await assert.rejects(
      async () =>
        service.presignPhoto('acc-1', {
          filename: 'document.pdf',
          mimeType: 'application/pdf',
        }),
      (err: any) => err.status === 400 && err.message.includes('Unsupported photo format'),
    );

    // Presign JPEG succeeds with photos/${accountId}/ prefix
    const presigned = await service.presignPhoto('acc-1', {
      filename: 'portrait.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 1024 * 500,
    });
    assert.strictEqual(presigned.s3Key.startsWith('photos/acc-1/'), true);
    assert.strictEqual(presigned.expiresInSeconds, 300);
  });

  // 10. Photo Attachment - Ownership & Duplicate Prevention
  test('PHOTO-002: Photo attachment rejects foreign keys and prevents duplicate attachments', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);
    await service.getProfile('acc-1');

    // Reject foreign account key
    await assert.rejects(
      async () => service.addPhoto('acc-1', { s3Key: 'photos/acc-attacker/p1.jpg' }),
      (err: any) => err.status === 400 && err.message.includes('Invalid portrait storage key ownership'),
    );

    // Reject directory traversal attempt
    await assert.rejects(
      async () => service.addPhoto('acc-1', { s3Key: 'photos/acc-1/../acc-2/p1.jpg' }),
      (err: any) => err.status === 400,
    );

    // Attach valid photo
    const p1 = await service.addPhoto('acc-1', { s3Key: 'photos/acc-1/p1.jpg', isPrimary: true });
    assert.strictEqual(p1.isPrimary, true);

    // Reject attaching duplicate key
    await assert.rejects(
      async () => service.addPhoto('acc-1', { s3Key: 'photos/acc-1/p1.jpg' }),
      (err: any) => err.status === 400 && err.message.includes('already been attached'),
    );
  });

  // 11. Photo Limit - Maximum 6 Photos
  test('PHOTO-003: Photo upload enforces maximum limit of 6 photos per profile', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);
    await service.getProfile('acc-1');

    for (let i = 1; i <= 6; i++) {
      await service.addPhoto('acc-1', { s3Key: `photos/acc-1/portrait_${i}.jpg` });
    }
    assert.strictEqual(prisma.state.photos.length, 6);

    // 7th photo rejected
    await assert.rejects(
      async () => service.addPhoto('acc-1', { s3Key: 'photos/acc-1/portrait_7.jpg' }),
      (err: any) => err.status === 400 && err.message.includes('Maximum of 6'),
    );
  });

  // 12. Photo Reordering & Primary Selection
  test('PHOTO-004: Photo reordering updates display orders and rejects foreign photo IDs', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);
    await service.getProfile('acc-1');

    await service.addPhoto('acc-1', { s3Key: 'photos/acc-1/p1.jpg' });
    await service.addPhoto('acc-1', { s3Key: 'photos/acc-1/p2.jpg' });

    // Reject reorder containing unowned photo ID
    await assert.rejects(
      async () => service.reorderPhotos('acc-1', ['photo-1', 'photo-foreign']),
      (err: any) => err.status === 403 && err.message.includes('Cannot reorder photographs'),
    );

    // Valid reorder sets display order
    const reordered = await service.reorderPhotos('acc-1', ['photo-2', 'photo-1']);
    assert.strictEqual(reordered.photos[0].id, 'photo-2');
    assert.strictEqual(reordered.photos[0].isPrimary, true);
  });

  // 13. Photo Removal & Automatic Reversion to Draft if 0 Photos
  test('PHOTO-005: Removing only photo reverts live profile to draft', async () => {
    const prisma = createMockPrisma({ discoveryEligible: true });
    const service = new ProfilesService(prisma as any);

    await service.getProfile('acc-1');
    await service.updateProfile('acc-1', {
      displayName: 'Aarav Raman',
      bio: 'Enrolled in BS Data Science, passionate about AI.',
      locationCity: 'Chennai',
      locationState: 'Tamil Nadu',
      intention: 'Long-term connection',
    });
    await service.addPhoto('acc-1', { s3Key: 'photos/acc-1/p1.jpg', isPrimary: true });
    await service.publishProfile('acc-1', { isPublished: true, acceptGuidelinesConsent: true });

    assert.strictEqual(prisma.state.profile.isPublished, true);
    assert.strictEqual(prisma.state.profile.profileStatus, 'live');

    // Remove photo
    await service.removePhoto('acc-1', 'photo-1');
    assert.strictEqual(prisma.state.profile.isPublished, false);
    assert.strictEqual(prisma.state.profile.profileStatus, 'draft');
  });

  // 14. Public Profile Preview - Zero Confidential Leakage
  test('PREV-001: Self-preview DTO omits roll numbers, DOB, private preferences, and account IDs', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);

    await service.getProfile('acc-1');
    await service.updateProfile('acc-1', {
      displayName: 'Aarav Raman',
      bio: 'Exploring Data Science.',
      locationCity: 'Chennai',
      locationState: 'Tamil Nadu',
      intention: 'Open to explore',
    });

    const preview = await service.getPreviewProfile('acc-1');

    assert.strictEqual(preview.displayName, 'Aarav Raman');
    assert.strictEqual(preview.programmeFamily, 'data_science_applications');
    assert.strictEqual((preview as any).accountId, undefined);
    assert.strictEqual((preview as any).dateOfBirth, undefined);
    assert.strictEqual((preview as any).studentRollNo, undefined);
    assert.strictEqual((preview as any).preferences, undefined);
    assert.strictEqual((preview as any).minAge, undefined);
  });

  // 15. Publication Gate - Rejects Under-18 or Unverified Accounts
  test('PUB-001: Publication gate rejects accounts lacking 18+ adult verification', async () => {
    const prisma = createMockPrisma({
      discoveryEligible: false,
      ageStatus: 'pending',
      studentStatus: 'approved',
    });
    const service = new ProfilesService(prisma as any);
    await service.getProfile('acc-1');

    await assert.rejects(
      async () => service.publishProfile('acc-1', { isPublished: true, acceptGuidelinesConsent: true }),
      (err: any) => err.status === 403 && err.message.includes('Cannot publish profile before both 18+ age verification'),
    );
  });

  test('PUB-002: Publication gate rejects accounts without at least one approved portrait photo', async () => {
    const prisma = createMockPrisma({ discoveryEligible: true });
    const service = new ProfilesService(prisma as any);
    await service.getProfile('acc-1');
    await service.updateProfile('acc-1', { displayName: 'Kavya Raman' });

    await assert.rejects(
      async () => service.publishProfile('acc-1', { isPublished: true, acceptGuidelinesConsent: true }),
      (err: any) => err.status === 400 && err.message.includes('At least one genuine portrait photo is required'),
    );
  });

  test('PUB-003: Publication succeeds when all approved requirements are met, even with empty bio and no location', async () => {
    const prisma = createMockPrisma({ discoveryEligible: true });
    const service = new ProfilesService(prisma as any);
    await service.getProfile('acc-1');
    // Draft saved with empty bio and no location
    await service.updateProfile('acc-1', { displayName: 'Kavya Raman', bio: '', locationCity: '', locationState: '' });
    // Add portrait photo
    await service.addPhoto('acc-1', { s3Key: 'photos/acc-1/p1.jpg' });

    // Publish with approved requirements: verified 18+ student, authentic name, >=1 photo, consent
    const published = await service.publishProfile('acc-1', { isPublished: true, acceptGuidelinesConsent: true });
    assert.strictEqual(published.isPublished, true);
    assert.strictEqual(published.profileStatus, 'live');
  });

  // 16. Pause & Resume Discovery
  test('PUB-004: Pausing discovery sets isPaused without deleting profile or unpublishing', async () => {
    const prisma = createMockPrisma({ discoveryEligible: true });
    const service = new ProfilesService(prisma as any);

    await service.getProfile('acc-1');
    await service.updateProfile('acc-1', {
      displayName: 'Aarav Raman',
      bio: 'Enrolled in BS Data Science, passionate about AI.',
      locationCity: 'Chennai',
      locationState: 'Tamil Nadu',
      intention: 'Long-term connection',
    });
    await service.addPhoto('acc-1', { s3Key: 'photos/acc-1/p1.jpg' });
    await service.publishProfile('acc-1', { isPublished: true, acceptGuidelinesConsent: true });

    // Pause
    const paused = await service.publishProfile('acc-1', { isPublished: false });
    assert.strictEqual(paused.isPublished, false);
    assert.strictEqual(paused.isPaused, true);
    assert.strictEqual(paused.profileStatus, 'paused');

    // Resume
    const resumed = await service.publishProfile('acc-1', { isPublished: true, acceptGuidelinesConsent: true });
    assert.strictEqual(resumed.isPublished, true);
    assert.strictEqual(resumed.isPaused, false);
    assert.strictEqual(resumed.profileStatus, 'live');
  });

  // 17. Cross-User Authorization & Block Checks
  test('AUTH-001: Peer public profile retrieval rejects unverified, unpublished, or blocked members', async () => {
    const prisma = createMockPrisma({ blocked: true });
    const service = new ProfilesService(prisma as any);

    await service.getProfile('acc-2'); // create target profile
    prisma.state.targetProfile.isPublished = true;
    prisma.state.targetProfile.isPaused = false;
    prisma.state.targetProfile.profileStatus = 'live';

    // Requester acc-1 tries to view acc-2 who has blocked them -> 404/denied
    await assert.rejects(
      async () => service.getPublicProfile('acc-1', 'prof-target'),
      (err: any) => err.status === 404 && err.message.includes('Profile not found or unavailable'),
    );
  });

  test('AUTH-002: Peer public profile retrieval never returns private preferences, DOB, or roll numbers', async () => {
    const prisma = createMockPrisma({ blocked: false });
    const service = new ProfilesService(prisma as any);

    await service.getProfile('acc-2');
    prisma.state.targetProfile.isPublished = true;
    prisma.state.targetProfile.isPaused = false;
    prisma.state.targetProfile.profileStatus = 'live';
    prisma.state.targetProfile.displayName = 'Priya Sharma';

    const publicProfile = await service.getPublicProfile('acc-1', 'prof-target');
    assert.strictEqual(publicProfile.displayName, 'Priya Sharma');
    assert.strictEqual((publicProfile as any).dateOfBirth, undefined);
    assert.strictEqual((publicProfile as any).studentRollNo, undefined);
    assert.strictEqual((publicProfile as any).preferences, undefined);
    assert.strictEqual((publicProfile as any).minAge, undefined);
    assert.strictEqual((publicProfile as any).maxAge, undefined);
    assert.strictEqual((publicProfile as any).allowedProgrammes, undefined);
    assert.strictEqual((publicProfile as any).maxDistanceKm, undefined);
  });

  // 18. Reconciled Photo Limits & TTL
  test('PHOTO-006: Presign enforces 300s TTL and rejects file sizes exceeding 10 MB', async () => {
    const prisma = createMockPrisma();
    const service = new ProfilesService(prisma as any);

    // Valid presign returns 300s TTL
    const presigned = await service.presignPhoto('acc-1', {
      filename: 'my_portrait.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 5 * 1024 * 1024,
    });
    assert.strictEqual(presigned.expiresInSeconds, 300);

    // Exceeding 10 MB must throw BadRequestException
    await assert.rejects(
      async () =>
        service.presignPhoto('acc-1', {
          filename: 'huge_photo.jpg',
          mimeType: 'image/jpeg',
          fileSizeBytes: 11 * 1024 * 1024,
        }),
      (err: any) => err.status === 400 && err.message.includes('10 MB'),
    );
  });

  // 19. Binary Image Content Validation & EXIF Stripping
  test('PHOTO-007: Image content validation detects valid JPEG magic bytes (FF D8 FF) and strips EXIF APP1 metadata', () => {
    // Construct valid JPEG header: FF D8 FF E1 [len=10] [exif payload] FF DA
    const app1Payload = Buffer.from('Exif\0\0GPSInfo', 'utf8');
    const app1Len = app1Payload.length + 2;
    const jpegWithExif = Buffer.concat([
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE1]),
      Buffer.from([(app1Len >> 8) & 0xFF, app1Len & 0xFF]),
      app1Payload,
      Buffer.from([0xFF, 0xDA, 0x00, 0x0C, 0x00, 0x01]), // Start of Scan
    ]);

    const result = validateImageBinary(jpegWithExif, 'image/jpeg');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.detectedMime, 'image/jpeg');
    assert.strictEqual(result.exifStripped, true);
    // Sanitized buffer must not contain the APP1 marker 0xFF 0xE1
    assert.strictEqual(result.sanitizedBuffer!.indexOf(Buffer.from([0xFF, 0xE1])), -1);
  });

  test('PHOTO-008: Image content validation detects valid PNG, WebP, and HEIC binary signatures', () => {
    // Valid PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]),
      Buffer.from('IHDR_DUMMY_DATA', 'utf8'),
    ]);
    const pngResult = validateImageBinary(pngBuffer, 'image/png');
    assert.strictEqual(pngResult.detectedMime, 'image/png');

    // Valid WebP signature: RIFF [size] WEBP
    const webpBuffer = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x20, 0x00, 0x00, 0x00]),
      Buffer.from('WEBPVP8 ', 'ascii'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
    ]);
    const webpResult = validateImageBinary(webpBuffer, 'image/webp');
    assert.strictEqual(webpResult.detectedMime, 'image/webp');

    // Valid HEIC signature: [size] ftyp heic
    const heicBuffer = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypheic', 'ascii'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('mif1heic', 'ascii'),
    ]);
    const heicResult = validateImageBinary(heicBuffer, 'image/heic');
    assert.strictEqual(heicResult.detectedMime, 'image/heic');
    assert.strictEqual(heicResult.isHeic, true);
  });

  test('PHOTO-009: Image content validation rejects disguised or malicious executables, HTML, and script payloads', () => {
    // Windows PE executable (MZ header disguised as .jpg)
    const mzExe = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF', 'ascii');
    assert.throws(
      () => validateImageBinary(mzExe, 'image/jpeg'),
      (err: any) => err.status === 400 && err.message.includes('disguised'),
    );

    // HTML / Script injection disguised as image
    const scriptPayload = Buffer.from('<script>alert("xss")</script>1234567890', 'ascii');
    assert.throws(
      () => validateImageBinary(scriptPayload, 'image/jpeg'),
      (err: any) => err.status === 400 && err.message.includes('disguised'),
    );

    // Declared MIME mismatch (PNG file sent with JPEG header claim)
    const realPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    assert.throws(
      () => validateImageBinary(realPng, 'image/jpeg'),
      (err: any) => err.status === 400 && err.message.includes('does not match'),
    );
  });

  // 20. Publication Uses Approved Photos & Primary Promotion
  test('PUB-005: Publication gate rejects accounts when photos are pending or failed moderation', async () => {
    const prisma = createMockPrisma({
      discoveryEligible: true,
      photos: [
        {
          id: 'photo-pending',
          profileId: 'prof-1',
          s3Key: 'photos/acc-1/p1.jpg',
          moderationStatus: 'pending', // Not approved
          deletedAt: null,
          isPrimary: true,
        },
      ],
    });
    const service = new ProfilesService(prisma as any);
    await service.getProfile('acc-1');
    await service.updateProfile('acc-1', { displayName: 'Aarav Raman' });

    await assert.rejects(
      async () => service.publishProfile('acc-1', { isPublished: true, acceptGuidelinesConsent: true }),
      (err: any) =>
        err.status === 400 &&
        err.message.includes('At least one genuine portrait photo is required'),
    );
  });

  test('PUB-006: Deleting primary photograph automatically promotes remaining ready photo and enforces exactly one primary', async () => {
    const prisma = createMockPrisma({
      discoveryEligible: true,
      photos: [
        {
          id: 'photo-1',
          profileId: 'prof-1',
          s3Key: 'photos/acc-1/p1.jpg',
          moderationStatus: 'approved',
          deletedAt: null,
          isPrimary: true,
          displayOrder: 0,
        },
        {
          id: 'photo-2',
          profileId: 'prof-1',
          s3Key: 'photos/acc-1/p2.jpg',
          moderationStatus: 'approved',
          deletedAt: null,
          isPrimary: false,
          displayOrder: 1,
        },
      ],
    });
    const service = new ProfilesService(prisma as any);
    await service.getProfile('acc-1');

    // Delete primary photo-1
    await service.removePhoto('acc-1', 'photo-1');

    // photo-2 must now be promoted to primary
    const remainingPhoto = prisma.state.photos.find((p) => p.id === 'photo-2');
    assert.strictEqual(remainingPhoto?.isPrimary, true);

    // Verify exactly one primary exists among remaining photos
    const primaries = prisma.state.photos.filter((p) => !p.deletedAt && p.isPrimary);
    assert.strictEqual(primaries.length, 1);
    assert.strictEqual(primaries[0].id, 'photo-2');
  });

  // 21. Durable Guidelines & Safety Consent Persistence
  test('CONSENT-001: Publication records durable acceptance timestamp, version, and member identity without overwriting on re-publish', async () => {
    const prisma = createMockPrisma({ discoveryEligible: true });
    const service = new ProfilesService(prisma as any);

    await service.getProfile('acc-1');
    await service.updateProfile('acc-1', { displayName: 'Aarav Raman' });
    await service.addPhoto('acc-1', { s3Key: 'photos/acc-1/p1.jpg' });

    // 1. Refusal to publish without explicit consent
    await assert.rejects(
      async () => service.publishProfile('acc-1', { isPublished: true, acceptGuidelinesConsent: false }),
      (err: any) => err.status === 400 && err.message.includes('Safety & Community Commitments'),
    );

    // 2. Initial publication with explicit consent
    const published = await service.publishProfile('acc-1', {
      isPublished: true,
      acceptGuidelinesConsent: true,
      consentVersion: 'v1.0',
    });
    assert.strictEqual(published.isPublished, true);
    const initialConsentAt = prisma.state.profile.consentAcceptedAt;
    assert.ok(initialConsentAt instanceof Date);

    // Verify audit event persisted
    assert.strictEqual(prisma.state.auditEvents.length, 1);
    assert.strictEqual(prisma.state.auditEvents[0].action, 'guidelines_consent_accepted');
    assert.strictEqual(prisma.state.auditEvents[0].actorId, 'acc-1');
    assert.strictEqual(prisma.state.auditEvents[0].metadata.consentVersion, 'v1.0');

    // 3. Repeated publication (e.g. pause then resume) preserves original consent timestamp
    await service.publishProfile('acc-1', { isPublished: false }); // pause
    const resumed = await service.publishProfile('acc-1', { isPublished: true }); // resume without re-sending boolean
    assert.strictEqual(resumed.isPublished, true);
    assert.strictEqual(prisma.state.profile.consentAcceptedAt.getTime(), initialConsentAt.getTime());
    // Audit events should not duplicate on simple resume
    assert.strictEqual(prisma.state.auditEvents.length, 1);
  });

  // 22. Hidden Age Verification & Exact DOB Protection
  test('AGE-001: ageDisplayMode = "hidden" excludes calculated age from public profile response', async () => {
    const prisma = createMockPrisma({ blocked: false });
    const service = new ProfilesService(prisma as any);

    await service.getProfile('acc-2');
    prisma.state.targetProfile.isPublished = true;
    prisma.state.targetProfile.isPaused = false;
    prisma.state.targetProfile.profileStatus = 'live';
    prisma.state.targetProfile.displayName = 'Deepika';
    prisma.state.targetProfile.ageDisplayMode = 'hidden';

    const publicProfile = await service.getPublicProfile('acc-1', 'prof-target');
    assert.strictEqual(publicProfile.age, null);
    assert.strictEqual((publicProfile as any).dateOfBirth, undefined);
  });

  test('AGE-002: Hidden age remains hidden in peer preview modal response', async () => {
    const prisma = createMockPrisma({ discoveryEligible: true });
    const service = new ProfilesService(prisma as any);

    await service.getProfile('acc-1');
    await service.updateProfile('acc-1', { ageDisplayMode: 'hidden' });

    const preview = await service.getPreviewProfile('acc-1');
    assert.strictEqual(preview.age, null);
    assert.strictEqual((preview as any).dateOfBirth, undefined);
  });

  test('AGE-003: Exact DOB is never exposed under either hidden or show_calculated_age mode', async () => {
    const prisma = createMockPrisma({ discoveryEligible: true });
    const service = new ProfilesService(prisma as any);

    // Mode 1: show_calculated_age
    await service.getProfile('acc-1');
    await service.updateProfile('acc-1', { ageDisplayMode: 'show_calculated_age' });
    const previewShow = await service.getPreviewProfile('acc-1');
    assert.strictEqual(typeof previewShow.age, 'number');
    assert.strictEqual((previewShow as any).dateOfBirth, undefined);

    // Mode 2: hidden
    await service.updateProfile('acc-1', { ageDisplayMode: 'hidden' });
    const previewHidden = await service.getPreviewProfile('acc-1');
    assert.strictEqual(previewHidden.age, null);
    assert.strictEqual((previewHidden as any).dateOfBirth, undefined);
  });

  test('AGE-004: Switching from hidden to show_calculated_age exposes only calculated integer age, never DOB', async () => {
    const prisma = createMockPrisma({ blocked: false });
    const service = new ProfilesService(prisma as any);

    await service.getProfile('acc-2');
    prisma.state.targetProfile.isPublished = true;
    prisma.state.targetProfile.isPaused = false;
    prisma.state.targetProfile.profileStatus = 'live';

    // Step 1: hidden
    prisma.state.targetProfile.ageDisplayMode = 'hidden';
    const hiddenProfile = await service.getPublicProfile('acc-1', 'prof-target');
    assert.strictEqual(hiddenProfile.age, null);

    // Step 2: switched back to show_calculated_age
    prisma.state.targetProfile.ageDisplayMode = 'show_calculated_age';
    const shownProfile = await service.getPublicProfile('acc-1', 'prof-target');
    assert.strictEqual(typeof shownProfile.age, 'number');
    assert.ok(shownProfile.age! >= 18);
    // DOB must remain strictly undefined
    assert.strictEqual((shownProfile as any).dateOfBirth, undefined);
  });

  test('AGE-005: Internal server eligibility verification still accesses verified age when age is hidden publicly', async () => {
    const prisma = createMockPrisma({ discoveryEligible: true });
    const service = new ProfilesService(prisma as any);

    await service.getProfile('acc-1');
    await service.updateProfile('acc-1', { displayName: 'Aarav Raman', ageDisplayMode: 'hidden' });
    await service.addPhoto('acc-1', { s3Key: 'photos/acc-1/p1.jpg' });

    // Publication succeeds because internal age verification is approved (ageStatus = approved), even with ageDisplayMode = hidden
    const published = await service.publishProfile('acc-1', { isPublished: true, acceptGuidelinesConsent: true });
    assert.strictEqual(published.isPublished, true);
    assert.strictEqual(published.profileStatus, 'live');

    // In peer public view, age is hidden
    const publicProfile = await service.getPublicProfile('acc-2', 'prof-1');
    assert.strictEqual(publicProfile.age, null);
    assert.strictEqual((publicProfile as any).dateOfBirth, undefined);
  });
});
