import { BadRequestException, Injectable } from '@nestjs/common';
import { datosOError } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';
import {
  COLUMNAS_PAGO,
  type CambiosPago,
  type FilaPago,
} from '../entities/index.js';
import { faltaEnLaBase } from './productos.repository.js';

const SIN_MIGRACION =
  'Falta crear la tabla de pagos: ejecuta en Supabase la migración 20261129000001_oc_pagos.sql';

/** Acceso a datos de `oc_pagos` (RLS: solo el dueño). */
@Injectable()
export class PagosRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(token: string, empresaId: string): Promise<FilaPago[]> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('oc_pagos')
      .select(COLUMNAS_PAGO)
      .eq('empresa_id', empresaId)
      .order('vence');
    // Sin la migración de pagos: la pestaña muestra las órdenes sin plan, sin romperse
    if (faltaEnLaBase(r.error)) return [];
    return (datosOError(r) as FilaPago[] | null) ?? [];
  }

  async obtener(
    token: string,
    empresaId: string,
    id: string,
  ): Promise<FilaPago> {
    return datosOError(
      await this.supabase
        .paraUsuario(token)
        .from('oc_pagos')
        .select(COLUMNAS_PAGO)
        .eq('empresa_id', empresaId)
        .eq('id', id)
        .single<FilaPago>(),
    );
  }

  async crear(token: string, fila: CambiosPago): Promise<FilaPago> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('oc_pagos')
      .insert(fila)
      .select(COLUMNAS_PAGO)
      .single<FilaPago>();
    if (faltaEnLaBase(r.error)) throw new BadRequestException(SIN_MIGRACION);
    return datosOError(r);
  }

  async actualizar(
    token: string,
    empresaId: string,
    id: string,
    cambios: CambiosPago,
  ): Promise<FilaPago> {
    return datosOError(
      await this.supabase
        .paraUsuario(token)
        .from('oc_pagos')
        .update(cambios)
        .eq('empresa_id', empresaId)
        .eq('id', id)
        .select(COLUMNAS_PAGO)
        .single<FilaPago>(),
    );
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
