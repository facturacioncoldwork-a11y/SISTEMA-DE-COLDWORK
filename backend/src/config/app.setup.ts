import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import type { Env } from './env.js';

/**
 * Configuración HTTP compartida por main.ts y las pruebas e2e,
 * para que las pruebas usen exactamente la misma app que producción.
 */
export function configurarApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Detrás de un balanceador / proxy (Cloud Run, nginx…): IP real del cliente
  // para el límite de peticiones y los logs.
  (app as NestExpressApplication).set('trust proxy', 1);

  // Un informe técnico lleva la firma del cliente: hasta 1 MB por petición (la base pone sus propios topes)
  (app as NestExpressApplication).useBodyParser('json', { limit: '1mb' });

  app.use(helmet());
  // Respuestas comprimidas (gzip): listas de asientos o productos viajan hasta 5-10 veces más livianas
  app.use(compression({ threshold: 1024 }));
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Empresa-Id', 'X-Request-Id', 'X-Tableta-Token'],
    exposedHeaders: ['X-Request-Id'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    maxAge: 600,
  });

  // /api/v1/...  (las versiones conviven: v2 se agrega sin romper v1)
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta campos no declarados en el DTO
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks(); // cierre ordenado al escalar hacia abajo / redeploy

  // Documentación interactiva solo fuera de producción: publicada sería un mapa de la API para un atacante
  if (config.get('SWAGGER_ENABLED', { infer: true }) && process.env['NODE_ENV'] !== 'production') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('COLDWORK ERP API')
        .setDescription('API del ERP de COLDWORK. Autenticación: JWT de Supabase (Bearer).')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }
}
