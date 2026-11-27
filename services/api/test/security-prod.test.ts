import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { CryptoService } from '../src/modules/identity/security/crypto.service';
import { ReviewerGuard } from '../src/modules/verification/reviewer.guard';
import { assertProductionAutoVerificationDisabled } from '../src/modules/verification/verification.adapters';
import { IdentityService } from '../src/modules/identity/identity.service';
import { VerificationService } from '../src/modules/verification/verification.service';
import { isCorsOriginAllowed, isSwaggerEnabled } from '../src/modules/platform/http-security';

describe('Production Fail-Closed Security Safeguards', () => {
  test('CryptoService rejects weak or default JWT secret in production', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_ACCESS_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      process.env.JWT_ACCESS_SECRET = 'dev-synthetic-access-secret-do-not-use-in-prod';
      assert.throws(() => new CryptoService(), /JWT_ACCESS_SECRET must be set securely/);

      process.env.JWT_ACCESS_SECRET = 'too-short';
      assert.throws(() => new CryptoService(), /JWT_ACCESS_SECRET must be set securely/);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
      else process.env.JWT_ACCESS_SECRET = prevSecret;
    }
  });

  test('Production mode blocks synthetic auto-approval flag immediately', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevFlag = process.env.SYNTHETIC_VERIFICATION_AUTO_APPROVE;
    try {
      process.env.NODE_ENV = 'production';
      process.env.SYNTHETIC_VERIFICATION_AUTO_APPROVE = 'true';
      assert.throws(
        () => assertProductionAutoVerificationDisabled(),
        (err: any) => err.status === 403 && err.message.includes('strictly disabled in production'),
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevFlag === undefined) delete process.env.SYNTHETIC_VERIFICATION_AUTO_APPROVE;
      else process.env.SYNTHETIC_VERIFICATION_AUTO_APPROVE = prevFlag;
    }
  });

  test('Production mode never returns devOtp even if EXPOSE_DEV_OTP=true', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevExpose = process.env.EXPOSE_DEV_OTP;
    const prevResend = process.env.RESEND_API_KEY;
    const prevSkip = process.env.SKIP_EMAIL_DISPATCH;
    try {
      process.env.NODE_ENV = 'production';
      process.env.EXPOSE_DEV_OTP = 'true';
      process.env.JWT_ACCESS_SECRET = 'prod-grade-secret-minimum-32-characters-long';
      process.env.SKIP_EMAIL_DISPATCH = 'true';
      delete process.env.RESEND_API_KEY;

      const cryptoSvc = new CryptoService();
      const tx: any = {
        account: {
          findUnique: async () => null,
          create: async (args: any) => ({ id: 'acc-p1', ...args.data }),
        },
        otpChallenge: {
          findFirst: async () => null,
          updateMany: async () => ({ count: 0 }),
          create: async (args: any) => ({ id: 'c1', ...args.data }),
        },
      };
      const mockPrisma: any = { ...tx, $transaction: async (cb: any) => cb(tx) };
      const ident = new IdentityService(
        mockPrisma,
        cryptoSvc,
        new VerificationService(mockPrisma),
      );
      const res = await ident.register({
        email: 'learner@study.iitm.ac.in',
        password: 'StrongPassword123!',
      });
      assert.strictEqual((res as any).devOtp, undefined);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevExpose === undefined) delete process.env.EXPOSE_DEV_OTP;
      else process.env.EXPOSE_DEV_OTP = prevExpose;
      if (prevResend === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = prevResend;
      if (prevSkip === undefined) delete process.env.SKIP_EMAIL_DISPATCH;
      else process.env.SKIP_EMAIL_DISPATCH = prevSkip;
    }
  });

  test('ReviewerGuard fails closed when unconfigured or supplied wrong key', () => {
    const prevKey = process.env.REVIEWER_API_KEY;
    try {
      const guard = new ReviewerGuard();
      const mkCtx = (key?: string): any => ({
        switchToHttp: () => ({
          getRequest: () => ({ headers: key ? { 'x-smn-reviewer-key': key } : {} }),
        }),
      });

      delete process.env.REVIEWER_API_KEY;
      assert.throws(() => guard.canActivate(mkCtx('anything')), (e: any) => e.status === 403);

      process.env.REVIEWER_API_KEY = 'valid-reviewer-secret-key-min-16';
      assert.throws(() => guard.canActivate(mkCtx('wrong-key')), (e: any) => e.status === 403);
      assert.strictEqual(guard.canActivate(mkCtx('valid-reviewer-secret-key-min-16')), true);
    } finally {
      if (prevKey === undefined) delete process.env.REVIEWER_API_KEY;
      else process.env.REVIEWER_API_KEY = prevKey;
    }
  });

  test('Production CORS rejects arbitrary origins & Swagger /docs disables cleanly in production', () => {
    const prodEnv: any = {
      NODE_ENV: 'production',
      WEB_APP_URL: 'https://saymyname.in',
    };
    assert.strictEqual(isCorsOriginAllowed('https://saymyname.in', prodEnv), true);
    assert.strictEqual(isCorsOriginAllowed('https://www.saymyname.in', prodEnv), true);
    assert.strictEqual(isCorsOriginAllowed('http://saymyname.in', prodEnv), false);
    assert.strictEqual(isCorsOriginAllowed('https://evil.example.com', prodEnv), false);
    assert.strictEqual(isCorsOriginAllowed('https://random-preview.vercel.app', prodEnv), false);

    assert.strictEqual(isSwaggerEnabled(prodEnv), false);
    assert.strictEqual(isSwaggerEnabled({ ...prodEnv, ENABLE_SWAGGER_DOCS: 'true' }), true);
    assert.strictEqual(isSwaggerEnabled({ NODE_ENV: 'development' }), true);
  });
});
