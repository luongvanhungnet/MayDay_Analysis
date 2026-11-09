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

// Middleware to normalize req.url when rewritten by Vercel
expressApp.use((req, _res, next) => {
  const matchedPath = (req.headers['x-matched-path'] || req.headers['x-now-route-matches']) as string;
  if (matchedPath && req.url === '/api') {
    req.url = matchedPath;
  }
  next();
});

export async function createNestApp(server = expressApp) {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { bodyParser: false });
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.setGlobalPrefix('api/v1');

  const originEnv = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  const origins = originEnv.split(',').map((s) => s.trim()).filter(Boolean);

  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
      return res.status(500).json({
        statusCode: 500,
        error: 'Bootstrap Error',
        message: err instanceof Error ? err.message : String(err),
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
