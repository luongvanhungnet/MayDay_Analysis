import { config } from 'dotenv';
import { resolve } from 'node:path';

config({
  path: [
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '../../../.env'),
    resolve(__dirname, '../../.env'),
  ],
});

// Support connection string aliases on cloud platforms (Vercel, Supabase, Neon, etc.)
if (!process.env.DATABASE_URL) {
  if (process.env.CONNECTION_STRING) {
    process.env.DATABASE_URL = process.env.CONNECTION_STRING;
  } else if (process.env.POSTGRES_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_URL;
  }
}

if (!process.env.DATABASE_URL) {
  const errMsg =
    '[MayDay Config Error] DATABASE_URL must be configured! Please check your Vercel Project Settings -> Environment Variables.';
  console.error(errMsg);
  throw new Error(errMsg);
}
