import fs from 'node:fs';
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let accountId = process.env.R2_ACCOUNT_ID;
let accessKeyId = process.env.R2_ACCESS_KEY_ID;
let secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
let bucketName = process.env.R2_BUCKET_NAME || 'saymyname-media';

if (!accessKeyId && fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  accountId = content.match(/R2_ACCOUNT_ID=([^\r\n]+)/)?.[1]?.trim() || accountId;
  accessKeyId = content.match(/R2_ACCESS_KEY_ID=([^\r\n]+)/)?.[1]?.trim() || accessKeyId;
  secretAccessKey = content.match(/R2_SECRET_ACCESS_KEY=([^\r\n]+)/)?.[1]?.trim() || secretAccessKey;
  bucketName = content.match(/R2_BUCKET_NAME=([^\r\n]+)/)?.[1]?.trim() || bucketName;
}

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error('R2 credentials not found in environment or .env.local');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function run() {
  console.log('--- Testing Cloudflare R2 Connection ---');
  try {
    // 1. Head Bucket Check
    console.log(`Checking bucket: "${bucketName}"...`);
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log('[PASS] HeadBucket succeeded! Bucket exists and credentials have access.');

    // 2. Put Test Object
    const testKey = `health-check/verify-${Date.now()}.json`;
    console.log(`Uploading test object: ${testKey}...`);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: JSON.stringify({
          service: 'SayMyName R2 Storage',
          verifiedAt: new Date().toISOString(),
          status: 'healthy',
        }),
        ContentType: 'application/json',
      }),
    );
    console.log('[PASS] PutObject succeeded!');

    // 3. List Objects
    const listRes = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 5,
      }),
    );
    console.log(`[PASS] ListObjects succeeded! Found ${listRes.KeyCount} objects in bucket.`);

    // 4. Generate Pre-signed Upload URL
    const presignedKey = `photos/test-presign-${Date.now()}.jpg`;
    const presignedUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucketName,
        Key: presignedKey,
        ContentType: 'image/jpeg',
      }),
      { expiresIn: 300 },
    );
    console.log('[PASS] Pre-signed PutObject URL generated successfully!');
    console.log('Sample Pre-signed URL format:', presignedUrl.split('?')[0]);

    console.log('\n🎉 Cloudflare R2 is 100% OPERATIONAL!');
  } catch (err) {
    console.error('[FAIL] R2 error:', err);
    process.exit(1);
  }
}

run();
