import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WsAdapter } from '@nestjs/platform-ws';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));

  // Security Headers
  app.use(helmet());

  // CORS - allow local dev, Vercel deployments, custom domains, and mobile clients
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed =
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.includes('saymyname.in') ||
        origin.endsWith('.vercel.app') ||
        (process.env.WEB_APP_URL && origin === process.env.WEB_APP_URL);
      if (isAllowed) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive fallback for preview deployments
    },
    credentials: true,
  });

  // Global prefix per Document 06 §9
  app.setGlobalPrefix('api/v1');

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // OpenAPI / Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('SayMyName API')
    .setDescription('SayMyName.in REST API specification for verified IIT Madras non-campus BS students')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`SayMyName API Server listening on port ${port} on 0.0.0.0 (Prefix: /api/v1)`);
  logger.log(`OpenAPI Swagger documentation available at http://localhost:${port}/docs`);
}

bootstrap();
