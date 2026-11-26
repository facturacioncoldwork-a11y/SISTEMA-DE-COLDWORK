import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { validarEnv, type Env } from './config/env.js';
import { SupabaseModule } from './database/supabase/supabase.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { EmpresasModule } from './modules/empresas/empresas.module.js';
import { EquipoModule } from './modules/equipo/equipo.module.js';
import { ContabilidadModule } from './modules/contabilidad/contabilidad.module.js';
import { AsistenciaModule } from './modules/asistencia/asistencia.module.js';
import { FinanzasModule } from './modules/finanzas/finanzas.module.js';
import { LogisticaModule } from './modules/logistica/logistica.module.js';
import { OperacionesModule } from './modules/operaciones/operaciones.module.js';

/**
 * Módulo raíz. Cada módulo de negocio del ERP (terceros, caja, ventas,
 * compras, contabilidad...) se agrega a `imports` como EmpresasModule.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validarEnv }),

    // Logs JSON estructurados (listos para Cloud Logging / Loki / Datadog),
    // con id de petición para seguir una llamada entre servicios.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          genReqId: (req, res) => {
            const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers.apikey'],
          // Logs compactos: lo útil para depurar, sin volcar todas las cabeceras
          serializers: {
            req: (req: { id: string; method: string; url: string; headers: Record<string, string> }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
              empresa: req.headers['x-empresa-id'],
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
          autoLogging: { ignore: (req) => (req.url ?? '').startsWith('/api/health') },
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        { ttl: config.get('THROTTLE_TTL_MS', { infer: true }), limit: config.get('THROTTLE_LIMIT', { infer: true }) },
      ],
    }),

    SupabaseModule,
    AuthModule,
    HealthModule,
    EmpresasModule,
    EquipoModule,
    LogisticaModule,
    ContabilidadModule,
    FinanzasModule,
    AsistenciaModule,
    OperacionesModule,
  ],
})
export class AppModule {}
