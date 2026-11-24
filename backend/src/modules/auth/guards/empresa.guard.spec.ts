import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { Area, AREA_REQUERIDA, Rol, ROLES_PERMITIDOS } from '../../../common/index.js';
import type { SupabaseService } from '../../../database/supabase/supabase.service.js';
import { EmpresaGuard, MEMBRESIAS } from './empresa.guard.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';

function armar(miembro: { rol: Rol; areas: Area[] } | null, metadatos: Record<string, unknown>) {
  const consulta = {
    select: () => consulta,
    eq: () => consulta,
    maybeSingle: () => Promise.resolve({ data: miembro, error: null }),
  };
  const supabase = { paraUsuario: () => ({ from: () => consulta }) } as unknown as SupabaseService;
  const reflector = { getAllAndOverride: (clave: string) => metadatos[clave] } as unknown as Reflector;
  const req: Record<string, unknown> = {
    usuario: { id: 'u1', token: 't' },
    header: (n: string) => (n === 'x-empresa-id' ? EMPRESA : undefined),
  };
  const ctx = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { guard: new EmpresaGuard(reflector, supabase), ctx, req };
}

describe('EmpresaGuard · áreas', () => {
  // Cada prueba usa el mismo usuario: se limpia la memoria de membresías
  beforeEach(() => MEMBRESIAS.olvidar(''));

  const ventas = { [ROLES_PERMITIDOS]: [], [AREA_REQUERIDA]: Area.Ventas };

  it('deja pasar a un trabajador con el área asignada', async () => {
    const { guard, ctx, req } = armar({ rol: Rol.Trabajador, areas: [Area.Ventas, Area.Tecnica] }, ventas);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req['empresa']).toEqual({ id: EMPRESA, rol: Rol.Trabajador, areas: [Area.Ventas, Area.Tecnica] });
  });

  it('bloquea a un trabajador sin esa área', async () => {
    const { guard, ctx } = armar({ rol: Rol.Trabajador, areas: [Area.Tecnica] }, ventas);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('dueño y admin entran a cualquier área', async () => {
    for (const rol of [Rol.Dueno, Rol.Admin]) {
      const { guard, ctx } = armar({ rol, areas: [] }, ventas);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    }
  });

  it('bloquea a quien no es miembro', async () => {
    const { guard, ctx } = armar(null, ventas);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no actúa en rutas sin @RequiereEmpresa', async () => {
    const { guard, ctx } = armar(null, {});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});

describe('EmpresaGuard · memoria de membresías', () => {
  beforeEach(() => MEMBRESIAS.olvidar(''));

  it('la segunda petición seguida no vuelve a consultar la base de datos', async () => {
    let consultas = 0;
    const consulta = {
      select: () => consulta,
      eq: () => consulta,
      maybeSingle: () => {
        consultas++;
        return Promise.resolve({ data: { rol: Rol.Dueno, areas: [] }, error: null });
      },
    };
    const supabase = { paraUsuario: () => ({ from: () => consulta }) } as unknown as SupabaseService;
    const reflector = { getAllAndOverride: (clave: string) => ({ [ROLES_PERMITIDOS]: [] } as Record<string, unknown>)[clave] } as unknown as Reflector;
    const req = { usuario: { id: 'u9', token: 't' }, header: () => EMPRESA };
    const ctx = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
    const guard = new EmpresaGuard(reflector, supabase);
    await guard.canActivate(ctx);
    await guard.canActivate(ctx);
    expect(consultas).toBe(1);
  });
});
