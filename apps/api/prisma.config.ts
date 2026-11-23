import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: [resolve(process.cwd(), '.env'), resolve(__dirname, '../../.env'), resolve(__dirname, '../../../.env')], quiet: true });

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.CONNECTION_STRING ||
  process.env.POSTGRES_URL ||
  'postgresql://postgres:postgres@localhost:5432/mayday?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});
