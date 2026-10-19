import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: [resolve(process.cwd(), '.env'), resolve(__dirname, '../../../.env')] });
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
if (!process.env.DATABASE_URL || !process.env.REDIS_URL) throw new Error('DATABASE_URL and REDIS_URL must be configured');
if (process.env.NODE_ENV === 'production' && (secret.includes('replace-with') || process.env.SEED_DEMO_PASSWORD)) throw new Error('Production requires a random JWT_SECRET and no demo seed password');
