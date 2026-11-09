import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const rawUrl =
      process.env.DATABASE_URL ||
      process.env.CONNECTION_STRING ||
      process.env.POSTGRES_URL;

    const cleanUrl = rawUrl ? rawUrl.trim() : undefined;

    super(
      cleanUrl
        ? {
            datasources: {
              db: {
                url: cleanUrl,
              },
            },
          }
        : undefined,
    );
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      console.error('[PrismaService] Database connection error during onModuleInit:', err);
      throw err;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch (err) {
      console.warn('[PrismaService] Error during $disconnect:', err);
    }
  }
}
