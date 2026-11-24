import fs from 'node:fs';
import { PrismaClient } from '@saymyname/database';

let url = process.env.DATABASE_URL;
if (!url && fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  url = content.match(/DATABASE_URL=([^\r\n]+)/)?.[1]?.trim() || url;
}

if (!url) {
  console.error('DATABASE_URL not found in environment or .env.local');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url } },
});

async function run() {
  console.log('--- Verifying Database Connection ---');
  const result = await prisma.$queryRawUnsafe('SELECT 1 as connected, current_user, current_database()');
  console.log('Connected to database:', result);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error('[ERROR]', e);
  process.exit(1);
});
