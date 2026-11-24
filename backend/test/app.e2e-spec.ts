import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/config/app.setup.js';
import { MEMBRESIAS } from '../src/modules/auth/guards/empresa.guard.js';
import { SupabaseService } from '../src/database/supabase/supabase.service.js';

const URL_SB = 'https://prueba.supabase.co';
const SECRETO = 'secreto-de-prueba-de-al-menos-32-caracteres!!';
const EMPRESA = '22222222-2222-2222-2222-222222222222';
const USUARIO = '11111111-1111-1111-1111-111111111111';

// Las variables de entorno de prueba están en test/setup-e2e.ts

const token = (sub = USUARIO) =>
  new SignJWT({ sub, email: 'dueno@coldwork.test' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(`${URL_SB}/auth/v1`)
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRETO));

/** Cliente de Supabase falso: simula lo que devolvería PostgREST con RLS. */
let rolEnEmpresa: string | null = 'dueno';
const tokensUsados: string[] = [];
const supabaseFalso = {
  disponible: async () => true,
  paraUsuario: (t: string) => {
    tokensUsados.push(t);
    const cadena: any = {
      select: () => cadena,
      eq: () => cadena,
      update: () => cadena,
      maybeSingle: async () => ({ data: rolEnEmpresa ? { rol: rolEnEmpresa } : null, error: null }),
      single: async () => ({
        data: { id: EMPRESA, razon_social: 'COLDWORK S.A.C.', ruc: '20123456789', nombre_comercial: null, direccion: null, moneda: 'PEN' },
        error: null,
      }),
    };
    return {
      from: () => cadena,
      rpc: async (fn: string) => {
        // EmpresasService.mias() acepta primero las invitaciones pendientes y luego lista
        if (fn === 'aceptar_invitaciones') return { data: 0, error: null };
        if (fn === 'mis_empresas')
          return {
            data: [{ id: EMPRESA, razon_social: 'COLDWORK S.A.C.', ruc: '20123456789', rol: 'dueno', areas: [] }],
            error: null,
          };
        return { data: null, error: { code: '42501', message: 'rls' } };
      },
    };
  },
};

describe('COLDWORK API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue(supabaseFalso)
      .compile();
    app = mod.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    rolEnEmpresa = 'dueno';
    tokensUsados.length = 0;
    MEMBRESIAS.olvidar(''); // cada prueba empieza sin membresías recordadas
  });

  it('GET /api/health es público', async () => {
    const r = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(r.body.estado).toBe('ok');
    expect(r.headers['x-request-id']).toBeTruthy();
  });

  it('GET /api/health/ready', () => request(app.getHttpServer()).get('/api/health/ready').expect(200));

  it('Swagger en /api/docs', () => request(app.getHttpServer()).get('/api/docs-json').expect(200));

  it('sin token → 401', () => request(app.getHttpServer()).get('/api/v1/empresas/mias').expect(401));

  it('token basura → 401', () =>
    request(app.getHttpServer()).get('/api/v1/empresas/mias').set('Authorization', 'Bearer abc.def.ghi').expect(401));

  it('con token → lista mis empresas y reenvía el token a Supabase (RLS)', async () => {
    const t = await token();
    const r = await request(app.getHttpServer()).get('/api/v1/empresas/mias').set('Authorization', `Bearer ${t}`).expect(200);
    expect(r.body).toEqual([{ id: EMPRESA, razonSocial: 'COLDWORK S.A.C.', ruc: '20123456789', rol: 'dueno', areas: [] }]);
    expect(tokensUsados).toContain(t);
  });

  it('ruta de empresa sin X-Empresa-Id → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/empresas/actual')
      .set('Authorization', `Bearer ${await token()}`)
      .expect(400);
  });

  it('empresa ajena → 403', async () => {
    rolEnEmpresa = null;
    await request(app.getHttpServer())
      .get('/api/v1/empresas/actual')
      .set('Authorization', `Bearer ${await token()}`)
      .set('X-Empresa-Id', EMPRESA)
      .expect(403);
  });

  it('empresa propia → 200 en camelCase', async () => {
    const r = await request(app.getHttpServer())
      .get('/api/v1/empresas/actual')
      .set('Authorization', `Bearer ${await token()}`)
      .set('X-Empresa-Id', EMPRESA)
      .expect(200);
    expect(r.body.razonSocial).toBe('COLDWORK S.A.C.');
  });

  it('trabajador no puede editar la empresa → 403', async () => {
    rolEnEmpresa = 'trabajador';
    await request(app.getHttpServer())
      .patch('/api/v1/empresas/actual')
      .set('Authorization', `Bearer ${await token()}`)
      .set('X-Empresa-Id', EMPRESA)
      .send({ razonSocial: 'Hack' })
      .expect(403);
  });

  it('valida el body: RUC inválido y campos extra → 400', async () => {
    const t = await token();
    await request(app.getHttpServer()).post('/api/v1/empresas').set('Authorization', `Bearer ${t}`).send({ razonSocial: 'X SAC', ruc: '123' }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/empresas').set('Authorization', `Bearer ${t}`).send({ razonSocial: 'X SAC', esAdmin: true }).expect(400);
  });

  it('error de RLS en Supabase → 403 (no 500)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/empresas')
      .set('Authorization', `Bearer ${await token()}`)
      .send({ razonSocial: 'Otra SAC' })
      .expect(403);
  });

  it('CORS permite el frontend configurado', async () => {
    const r = await request(app.getHttpServer())
      .options('/api/v1/empresas/mias')
      .set('Origin', 'http://localhost:4200')
      .set('Access-Control-Request-Method', 'GET');
    expect(r.headers['access-control-allow-origin']).toBe('http://localhost:4200');
  });
});
