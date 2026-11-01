import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: [resolve(process.cwd(), '.env'), resolve(__dirname, '../../../.env')] });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured');
