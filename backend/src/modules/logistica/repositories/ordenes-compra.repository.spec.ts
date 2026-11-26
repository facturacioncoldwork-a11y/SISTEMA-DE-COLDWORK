import { describe, expect, it } from 'vitest';
import type { SupabaseService } from '../../../database/supabase/supabase.service.js';
import { SELECT_ORDEN_COMPRA_SIN_PROYECTO } from '../entities/index.js';
import { OrdenesCompraRepository } from './ordenes-compra.repository.js';

/** Supabase simulado: responde en orden las consultas y guarda qué columnas pidió cada una. */
function supabaseConRespuestas(respuestas: unknown[]) {
  const pedidos: { select?: string; update?: Record<string, unknown> }[] = [];
  const cliente = {
    from() {
      const pedido: { select?: string; update?: Record<string, unknown> } = {};
      pedidos.push(pedido);
      const q: Record<string, unknown> = {};
      q['select'] = (c: string) => ((pedido.select ??= c), q);
      q['update'] = (c: Record<string, unknown>) => ((pedido.update = c), q);
      q['eq'] = () => q;
      const fin = () => Promise.resolve(respuestas.shift());
      q['order'] = () => q;
      q['limit'] = fin;
      q['single'] = fin;
      return q;
    },
  };
  return {
    supabase: { paraUsuario: () => cliente } as unknown as SupabaseService,
    pedidos,
  };
}

const sinColumna = {
  data: null,
  error: {
    code: '42703',
    message: 'column ordenes_compra.proyecto_id does not exist',
  },
};

describe('órdenes de compra si la base aún no tiene la migración de pagos', () => {
  it('el SELECT de respaldo no pide las columnas nuevas', () => {
    expect(SELECT_ORDEN_COMPRA_SIN_PROYECTO).not.toContain('proyecto_id');
    expect(SELECT_ORDEN_COMPRA_SIN_PROYECTO).not.toContain('fecha_aprobado');
    expect(SELECT_ORDEN_COMPRA_SIN_PROYECTO).toContain('cotizacion_ref');
  });

  it('listar reintenta sin proyecto y devuelve las órdenes', async () => {
    const { supabase, pedidos } = supabaseConRespuestas([
      sinColumna,
      { data: [{ id: 'oc1' }], error: null },
    ]);
    const r = await new OrdenesCompraRepository(supabase).listar('t', 'e');
    expect(r).toEqual([{ id: 'oc1' }]);
    expect(pedidos[1].select).toBe(SELECT_ORDEN_COMPRA_SIN_PROYECTO);
  });

  it('al guardar, omite proyecto y fecha de aprobación pero guarda lo demás', async () => {
    const { supabase, pedidos } = supabaseConRespuestas([
      {
        data: null,
        error: {
          code: 'PGRST204',
          message: "Could not find the 'fecha_aprobado' column",
        },
      },
      { data: { id: 'oc1' }, error: null },
    ]);
    await new OrdenesCompraRepository(supabase).actualizar('t', 'e', 'oc1', {
      notas: 'hola',
      fecha_aprobado: '2026-10-07',
      proyecto_id: null,
    });
    expect(pedidos[1].update).toEqual({ notas: 'hola' });
  });

  it('si solo se pedía proyecto o fecha de aprobación, no falla', async () => {
    const { supabase, pedidos } = supabaseConRespuestas([
      { data: null, error: { code: 'PGRST204', message: 'falta columna' } },
    ]);
    await expect(
      new OrdenesCompraRepository(supabase).actualizar('t', 'e', 'oc1', {
        fecha_aprobado: '2026-10-07',
      }),
    ).resolves.toBeUndefined();
    expect(pedidos).toHaveLength(1);
  });
});
