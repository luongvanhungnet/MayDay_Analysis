import './config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter, ApiResponseInterceptor } from './common/api-response';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(helmet()); app.use(json({ limit: '1mb' }));
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(','), methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] });
  app.useGlobalFilters(new ApiExceptionFilter()); app.useGlobalInterceptors(new ApiResponseInterceptor());
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder().setTitle('MayDay API').setDescription('Clinical records, dynamic forms, lesion tracking and access control. All private endpoints require a Bearer token.').setVersion('1.0').addBearerAuth().build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
void bootstrap();
