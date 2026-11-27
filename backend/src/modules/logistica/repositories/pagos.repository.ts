import { BadRequestException, Injectable } from '@nestjs/common';
import { datosOError } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';
import {
  COLUMNAS_PAGO,
  COLUMNAS_PAGO_BASE,
  type CambiosPago,
  type FilaPago,
} from '../entities/index.js';
import { columnaFaltante } from './ordenes-compra.repository.js';
import { faltaEnLaBase } from './productos.repository.js';

const SIN_MIGRACION =
  'Falta crear la tabla de pagos: ejecuta en Supabase la migración 20261129000001_oc_pagos.sql';

/** Acceso a datos de `oc_pagos` (RLS: solo el dueño). */
@Injectable()
export class PagosRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(token: string, empresaId: string): Promise<FilaPago[]> {
    const consultar = (columnas: string) =>
      this.supabase
        .paraUsuario(token)
        .from('oc_pagos')
        .select(columnas)
        .eq('empresa_id', empresaId)
        .order('vence');
    let r = await consultar(COLUMNAS_PAGO);
    // Sin la migración "pagos al llegar": se lee sin esa columna
    if (columnaFaltante(r.error)) r = await consultar(COLUMNAS_PAGO_BASE);
    // Sin la migración de pagos: la pestaña muestra las órdenes sin plan, sin romperse
    if (faltaEnLaBase(r.error)) return [];
    return (datosOError(r) as unknown as FilaPago[] | null) ?? [];
  }

  async obtener(
    token: string,
    empresaId: string,
    id: string,
  ): Promise<FilaPago> {
    const consultar = (columnas: string) =>
      this.supabase
        .paraUsuario(token)
        .from('oc_pagos')
        .select(columnas)
        .eq('empresa_id', empresaId)
        .eq('id', id)
        .single<FilaPago>();
    let r = await consultar(COLUMNAS_PAGO);
    if (columnaFaltante(r.error)) r = await consultar(COLUMNAS_PAGO_BASE);
    return datosOError(r);
  }

  async crear(token: string, fila: CambiosPago): Promise<FilaPago> {
    const insertar = (f: CambiosPago, columnas: string) =>
      this.supabase
        .paraUsuario(token)
        .from('oc_pagos')
        .insert(f)
        .select(columnas)
        .single<FilaPago>();
    let r = await insertar(fila, COLUMNAS_PAGO);
    if (faltaEnLaBase(r.error)) throw new BadRequestException(SIN_MIGRACION);
    if (columnaFaltante(r.error))
      r = await insertar(sinAlLlegar(fila), COLUMNAS_PAGO_BASE);
    return datosOError(r);
  }

  async actualizar(
    token: string,
    empresaId: string,
    id: string,
    cambios: CambiosPago,
  ): Promise<FilaPago> {
    const guardar = (c: CambiosPago, columnas: string) =>
      this.supabase
        .paraUsuario(token)
        .from('oc_pagos')
        .update(c)
        .eq('empresa_id', empresaId)
        .eq('id', id)
        .select(columnas)
        .single<FilaPago>();
    let r = await guardar(cambios, COLUMNAS_PAGO);
    if (columnaFaltante(r.error)) {
      const resto = sinAlLlegar(cambios);
      r = Object.keys(resto).length
        ? await guardar(resto, COLUMNAS_PAGO_BASE)
        : await this.supabase
            .paraUsuario(token)
            .from('oc_pagos')
            .select(COLUMNAS_PAGO_BASE)
            .eq('empresa_id', empresaId)
            .eq('id', id)
            .single<FilaPago>();
    }
    return datosOError(r);
  }

  /** DELETE real. Devuelve false si no existía. */
  async eliminar(
    token: string,
    empresaId: string,
    id: string,
  ): Promise<boolean> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('oc_pagos')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select('id');
    return ((datosOError(r) as { id: string }[] | null) ?? []).length > 0;
  }
}

/** Sin la migración 20261202000001 la columna no existe: la cuota queda con fecha fija. */
function sinAlLlegar(c: CambiosPago): CambiosPago {
  const resto = { ...c };
  delete resto.dias_tras_llegada;
  return resto;
}
