import './config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ApiExceptionFilter, ApiResponseInterceptor } from './common/api-response';

const expressApp = express();
let isAppReady = false;

function getSafeDbTarget(rawUrl?: string) {
  if (!rawUrl) return { status: 'DATABASE_URL is not set' };
  try {
    const u = new URL(rawUrl.trim());
    return {
      protocol: u.protocol,
      host: u.hostname,
      port: u.port || '5432 (default)',
      database: u.pathname.replace(/^\//, ''),
      username: u.username || '(none)',
    };
  } catch {
    return { status: 'Unable to parse URL format' };
  }
}

// Root info endpoint for quick health and browser verification
expressApp.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'MayDay API',
    endpoints: {
      health: '/api/v1/health',
      docs: '/api/docs',
    },
  });
});

// Middleware to normalize req.url when rewritten by Vercel or containing duplicate slashes, and auto-prefix /api/v1
expressApp.use((req, _res, next) => {
  const matchedPath = (req.headers['x-matched-path'] || req.headers['x-now-route-matches']) as string;
  if (matchedPath && req.url === '/api') {
    req.url = matchedPath;
  }
  if (req.url && req.url.includes('//')) {
    req.url = req.url.replace(/\/+/g, '/');
  }

  // Handle requests sent to /auth/login or /api/auth/login instead of /api/v1/auth/login
  if (req.url && req.url !== '/' && !req.url.startsWith('/api/docs')) {
    if (req.url.startsWith('/api/v1')) {
      // already has /api/v1 prefix
    } else if (req.url.startsWith('/api/')) {
      req.url = req.url.replace(/^\/api\//, '/api/v1/');
    } else {
      req.url = `/api/v1${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
    }
  }

  next();
});

export async function createNestApp(server = expressApp) {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { bodyParser: false });
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.setGlobalPrefix('api/v1');

  const originEnv = process.env.WEB_ORIGIN;
  const configuredOrigins = originEnv
    ? originEnv.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean)
    : [];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      if (!originEnv || originEnv === '*') return callback(null, true);

      const cleanOrigin = origin.replace(/\/+$/, '');
      if (
        configuredOrigins.includes(cleanOrigin) ||
        cleanOrigin.endsWith('.vercel.app') ||
        cleanOrigin.includes('localhost') ||
        cleanOrigin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    credentials: true,
  });

  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('MayDay API')
      .setDescription(
        'Clinical records, dynamic forms, lesion tracking and access control. All private endpoints require a Bearer token.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  app.enableShutdownHooks();
  await app.init();
  return app;
}

// Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  if (!isAppReady) {
    try {
      await createNestApp(expressApp);
      isAppReady = true;
    } catch (err) {
      console.error('[Vercel Bootstrap Error] Failed to bootstrap NestJS:', err);
      const activeDb =
        process.env.DATABASE_URL ||
        process.env.CONNECTION_STRING ||
        process.env.POSTGRES_URL;

      return res.status(500).json({
        statusCode: 500,
        error: 'Bootstrap Error',
        message: err instanceof Error ? err.message : String(err),
        currentDatabaseTarget: getSafeDbTarget(activeDb),
      });
    }
  }
  return expressApp(req, res);
}

// Standalone mode: for local development (`npm run dev`) or container run
if (require.main === module && !process.env.VERCEL) {
  (async () => {
    await createNestApp(expressApp);
    const port = Number(process.env.PORT ?? 3000);
    expressApp.listen(port, '0.0.0.0', () => {
      console.log(`MayDay API listening on http://0.0.0.0:${port}`);
    });
  })().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
