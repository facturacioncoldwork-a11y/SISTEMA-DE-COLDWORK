import { describe, expect, it } from 'vitest';
import type { SupabaseService } from '../../../database/supabase/supabase.service.js';
import { faltaEnLaBase, ProductosRepository } from './productos.repository.js';

/** Supabase simulado: la consulta encadenada termina (en .order) con `respuesta`. */
function supabaseQueResponde(respuesta: unknown): SupabaseService {
  const consulta: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq']) consulta[m] = () => consulta;
  consulta['order'] = () => Promise.resolve(respuesta); // último paso de la consulta
  return { paraUsuario: () => consulta } as unknown as SupabaseService;
}

describe('lotes de stock (antigüedad)', () => {
  it('si falta la vista stock_lotes (migración 0011), logística carga igual sin lotes', async () => {
    const repo = new ProductosRepository(
      supabaseQueResponde({
        data: null,
        error: {
          code: 'PGRST205',
          message: "Could not find the table 'public.stock_lotes'",
        },
      }),
    );
    expect(await repo.lotes('token', 'empresa')).toEqual([]);
  });

  it('otros errores sí se informan', async () => {
    const repo = new ProductosRepository(
      supabaseQueResponde({
        data: null,
        error: { code: '42501', message: 'permiso' },
      }),
    );
    await expect(repo.lotes('token', 'empresa')).rejects.toBeTruthy();
  });

  it('reconoce tabla o vista inexistente', () => {
    expect(faltaEnLaBase({ code: 'PGRST205' })).toBe(true);
    expect(faltaEnLaBase({ code: '42P01' })).toBe(true);
    expect(faltaEnLaBase({ code: '23503' })).toBe(false);
    expect(faltaEnLaBase(null)).toBe(false);
  });
});
