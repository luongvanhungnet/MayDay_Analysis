import { defineConfig, env } from 'prisma/config';
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: [resolve(process.cwd(), '.env'), resolve(__dirname, '../../.env')], quiet: true });
export default defineConfig({ schema: 'prisma/schema.prisma', datasource: { url: env('DATABASE_URL') } });
