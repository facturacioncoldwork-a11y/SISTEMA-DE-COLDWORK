import { Injectable } from '@nestjs/common';
import { datosOError } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';
import {
  SELECT_LLEGADA,
  SELECT_SALIDA,
  type FilaLlegada,
  type FilaSalida,
} from '../entities/index.js';

/** Acceso a datos de llegadas y salidas. Registrar va por RPC: stock + kardex en una sola transacción. */
@Injectable()
export class MovimientosRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listarLlegadas(
    token: string,
    empresaId: string,
    limite = 200,
  ): Promise<FilaLlegada[]> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('llegadas')
      .select(SELECT_LLEGADA)
      .eq('empresa_id', empresaId)
      .order('numero', { ascending: false })
      .limit(limite);
    return (datosOError(r) as unknown as FilaLlegada[] | null) ?? [];
  }

  async obtenerLlegada(
    token: string,
    empresaId: string,
    id: string,
  ): Promise<FilaLlegada> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('llegadas')
      .select(SELECT_LLEGADA)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single();
    return datosOError(r) as unknown as FilaLlegada;
  }

  async registrarLlegada(
    token: string,
    empresaId: string,
    datos: unknown,
  ): Promise<string> {
    return datosOError(
      await this.supabase
        .paraUsuario(token)
        .rpc('registrar_llegada', { p_empresa: empresaId, p_datos: datos }),
    ) as string;
  }

  async listarSalidas(
    token: string,
    empresaId: string,
    limite = 200,
  ): Promise<FilaSalida[]> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('salidas')
      .select(SELECT_SALIDA)
      .eq('empresa_id', empresaId)
      .order('numero', { ascending: false })
      .limit(limite);
    return (datosOError(r) as unknown as FilaSalida[] | null) ?? [];
  }

  async obtenerSalida(
    token: string,
    empresaId: string,
    id: string,
  ): Promise<FilaSalida> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('salidas')
      .select(SELECT_SALIDA)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single();
    return datosOError(r) as unknown as FilaSalida;
  }

  async registrarSalida(
    token: string,
    empresaId: string,
    datos: unknown,
  ): Promise<string> {
    return datosOError(
      await this.supabase
        .paraUsuario(token)
        .rpc('registrar_salida', { p_empresa: empresaId, p_datos: datos }),
    ) as string;
  }

  async actualizarLlegada(
    token: string,
    empresaId: string,
    id: string,
    cambios: Record<string, unknown>,
  ): Promise<void> {
    datosOError(
      await this.supabase
        .paraUsuario(token)
        .from('llegadas')
        .update(cambios)
        .eq('empresa_id', empresaId)
        .eq('id', id)
        .select('id')
        .single(),
    );
  }

  /** Revierte stock, kardex y avance de la OC, y borra la llegada (todo en SQL). */
  async eliminarLlegada(
    token: string,
    empresaId: string,
    id: string,
  ): Promise<void> {
    datosOError(
      await this.supabase
        .paraUsuario(token)
        .rpc('eliminar_llegada', { p_empresa: empresaId, p_llegada: id }),
    );
  }

  async actualizarSalida(
    token: string,
    empresaId: string,
    id: string,
    cambios: Record<string, unknown>,
  ): Promise<void> {
    datosOError(
      await this.supabase
        .paraUsuario(token)
        .from('salidas')
        .update(cambios)
        .eq('empresa_id', empresaId)
        .eq('id', id)
        .select('id')
        .single(),
    );
  }

  /** Devuelve el stock al almacén y borra la salida (todo en SQL). */
  async eliminarSalida(
    token: string,
    empresaId: string,
    id: string,
  ): Promise<void> {
    datosOError(
      await this.supabase
        .paraUsuario(token)
        .rpc('eliminar_salida', { p_empresa: empresaId, p_salida: id }),
    );
  }
}
