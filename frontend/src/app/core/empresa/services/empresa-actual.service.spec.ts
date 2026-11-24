import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MiEmpresa } from '../../../modules/empresas/models/empresa.model';
import { ApiService } from '../../api/services/api.service';
import { AuthService } from '../../auth/services/auth.service';
import { EmpresaActualService } from './empresa-actual.service';

describe('EmpresaActualService · permisos por área', () => {
  let svc: EmpresaActualService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: {} }] });
    svc = TestBed.inject(EmpresaActualService);
  });

  it('un trabajador solo puede entrar a sus áreas', () => {
    svc.cargar([{ id: 'E1', razonSocial: 'COLDWORK', ruc: null, rol: 'trabajador', areas: ['tecnica', 'contabilidad'] }]);
    expect(svc.puede('tecnica')).toBe(true);
    expect(svc.puede('contabilidad')).toBe(true);
    expect(svc.puede('ventas')).toBe(false);
    expect(svc.esAdmin()).toBe(false);
  });

  it('dueño y admin entran a todo', () => {
    for (const rol of ['dueno', 'admin'] as const) {
      svc.cargar([{ id: 'E1', razonSocial: 'COLDWORK', ruc: null, rol, areas: [] }]);
      expect(svc.puede('ventas')).toBe(true);
      expect(svc.esAdmin()).toBe(true);
    }
  });

  it('sin empresa no puede nada', () => {
    expect(svc.puede('ventas')).toBe(false);
  });
});

describe('EmpresaActualService · arranque rápido', () => {
  const DUENO: MiEmpresa[] = [{ id: 'E1', razonSocial: 'COLDWORK', ruc: null, rol: 'dueno', areas: [] }];
  const usuario = signal<{ id: string } | null>({ id: 'U1' });
  let get: ReturnType<typeof vi.fn>;
  let svc: EmpresaActualService;

  beforeEach(() => {
    localStorage.clear();
    usuario.set({ id: 'U1' });
    get = vi.fn(() => new Promise<MiEmpresa[]>(() => undefined)); // servidor dormido: nunca responde
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: { get } },
        { provide: AuthService, useValue: { usuario } },
      ],
    });
    svc = TestBed.inject(EmpresaActualService);
  });

  it('sin lista guardada espera al servidor', async () => {
    get.mockResolvedValueOnce(DUENO);
    expect(await svc.asegurar()).toEqual(DUENO);
    expect(JSON.parse(localStorage.getItem('coldwork-mis-empresas:U1')!)).toEqual(DUENO);
  });

  it('con lista guardada de la misma cuenta entra al instante aunque el servidor no responda', async () => {
    localStorage.setItem('coldwork-mis-empresas:U1', JSON.stringify(DUENO));
    expect(await svc.asegurar()).toEqual(DUENO);
    expect(svc.esDueno()).toBe(true);
    expect(get).toHaveBeenCalledOnce(); // igual se confirma con el servidor
  });

  it('nunca usa la lista guardada de otra cuenta', () => {
    localStorage.setItem('coldwork-mis-empresas:OTRA', JSON.stringify(DUENO));
    void svc.asegurar();
    expect(svc.empresas()).toEqual([]);
  });

  it('al cerrar sesión borra las listas guardadas', () => {
    localStorage.setItem('coldwork-mis-empresas:U1', JSON.stringify(DUENO));
    usuario.set(null);
    svc.limpiar();
    expect(localStorage.getItem('coldwork-mis-empresas:U1')).toBeNull();
  });
});
