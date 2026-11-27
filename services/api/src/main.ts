import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WsAdapter } from '@nestjs/platform-ws';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { isCorsOriginAllowed, isSwaggerEnabled } from './modules/platform/http-security';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));

  // Security Headers
  app.use(helmet());

  // Strict CORS in production (fail closed for unknown browser origins), dev-friendly locally
  app.enableCors({
    origin: (origin, callback) => {
      if (isCorsOriginAllowed(origin, process.env)) {
        return callback(null, true);
      }
      return callback(null, false);
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

  // OpenAPI / Swagger Documentation (gated off by default in NODE_ENV=production)
  if (isSwaggerEnabled(process.env)) {
    const config = new DocumentBuilder()
      .setTitle('SayMyName API')
      .setDescription(
        'SayMyName.in REST API specification for verified IIT Madras non-campus BS students',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`SayMyName API Server listening on port ${port} on 0.0.0.0 (Prefix: /api/v1)`);
  if (isSwaggerEnabled(process.env)) {
    logger.log(`OpenAPI Swagger documentation available at http://localhost:${port}/docs`);
  }
}

bootstrap();
