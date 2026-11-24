import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { CryptoService } from '../src/modules/identity/security/crypto.service';
import { IdentityService } from '../src/modules/identity/identity.service';
import { ProgrammeFamily } from '@saymyname/contracts';

describe('Identity, Eligibility & Auth Domain Tests', () => {
  const cryptoService = new CryptoService();
  const mockPrisma = {
    accountEligibility: {
      findUnique: async () => ({ ageStatus: 'approved' }),
      update: async (args: any) => ({
        accountId: 'mock-id',
        ageStatus: args.data.ageStatus || 'approved',
        studentStatus: args.data.studentStatus || 'not_started',
        programmeFamily: args.data.programmeFamily || null,
        discoveryEligible: args.data.discoveryEligible ?? false,
        account: { email: 'student@study.iitm.ac.in', displayName: 'IITM Student' },
      }),
    },
    account: {
      update: async () => ({}),
      findUnique: async () => null,
      create: async () => ({}),
    },
    appSession: {
      create: async () => ({}),
      findUnique: async () => null,
      update: async () => ({}),
    },
  };

  const identityService = new IdentityService(mockPrisma as any, cryptoService);

  test('Rule 1: Email must be official IITM domain', () => {
    assert.strictEqual(identityService.validateIitmEmail('21f1000123@study.iitm.ac.in'), true);
    assert.strictEqual(identityService.validateIitmEmail('student@ds.study.iitm.ac.in'), true);
    assert.strictEqual(identityService.validateIitmEmail('student@es.study.iitm.ac.in'), true);
    assert.strictEqual(identityService.validateIitmEmail('faculty@iitm.ac.in'), true);
    
    // Ineligible domains (rejected)
    assert.strictEqual(identityService.validateIitmEmail('stranger@gmail.com'), false);
    assert.strictEqual(identityService.validateIitmEmail('user@yahoo.co.in'), false);
    assert.strictEqual(identityService.validateIitmEmail('student@mit.edu'), false);
  });

  test('Rule 2: Under-18 age gate strictly rejects (< 18)', async () => {
    const today = new Date();
    const underageDob = `${today.getFullYear() - 17}-01-01`; // 17 years old
    
    await assert.rejects(
      async () => {
        await identityService.checkAge('mock-id', { dateOfBirth: underageDob });
      },
      (err: any) => {
        return err.status === 403 && err.message.includes('SayMyName is strictly for verified adults (18+)');
      }
    );
  });

  test('Rule 3: 18+ adult age gate succeeds (>= 18)', async () => {
    const today = new Date();
    const adultDob = `${today.getFullYear() - 20}-01-01`; // 20 years old
    
    const result = await identityService.checkAge('mock-id', { dateOfBirth: adultDob });
    assert.strictEqual(result.calculatedAge >= 18, true);
    assert.strictEqual(result.eligibility.ageStatus, 'approved');
  });

  test('Rule 4: Only 4 approved IITM BS programme families are permitted', async () => {
    const validProgrammes = [
      ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
      ProgrammeFamily.ELECTRONIC_SYSTEMS,
      ProgrammeFamily.AERONAUTICS_SPACE,
      ProgrammeFamily.MANAGEMENT_DATA_SCIENCE,
    ];

    for (const prog of validProgrammes) {
      const res = await identityService.verifyStudent('mock-id', {
        programmeFamily: prog,
        studentRollNo: '21f1000123',
      });
      assert.strictEqual(res.eligibility.studentStatus, 'approved');
      assert.strictEqual(res.eligibility.discoveryEligible, true);
    }

    // Invalid programme rejected
    await assert.rejects(
      async () => {
        await identityService.verifyStudent('mock-id', {
          programmeFamily: 'btech_computer_science', // Unapproved on-campus programme
          studentRollNo: 'cs123',
        });
      },
      (err: any) => {
        return err.status === 400 && err.message.includes('Invalid programme track');
      }
    );
  });

  test('Rule 5: JWT signing and verification integrity', () => {
    const token = cryptoService.generateJwt({
      sub: 'user-uuid-1234',
      email: 'student@study.iitm.ac.in',
      discoveryEligible: true,
    }, 3600);

    const decoded = cryptoService.verifyJwt(token);
    assert.strictEqual(decoded.sub, 'user-uuid-1234');
    assert.strictEqual(decoded.email, 'student@study.iitm.ac.in');
    assert.strictEqual(decoded.discoveryEligible, true);

    // Tampered token rejected
    const tampered = token.slice(0, -5) + 'AAAAA';
    assert.throws(() => cryptoService.verifyJwt(tampered));
  });
});
