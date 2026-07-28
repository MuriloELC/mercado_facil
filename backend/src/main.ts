import 'reflect-metadata';
import './config/bootstrap';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { AppLogger } from './logging/app.logger';
import { RequestLoggingInterceptor } from './logging/request-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLogger, { strict: false }) ?? new AppLogger();
  app.useLogger(logger);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new RequestLoggingInterceptor(logger));

  app.enableCors();

  const uploadDir = process.env.UPLOAD_DIR ?? 'uploads/receipts';
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log(`backend.started`, 'Bootstrap', {
    port,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    uploadDir,
  });
}

bootstrap();
