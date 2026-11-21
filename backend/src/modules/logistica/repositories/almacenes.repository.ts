import { Injectable } from '@nestjs/common';
import { datosOError } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';
import { COLUMNAS_ALMACEN, type AlmacenEntity } from '../entities/index.js';

export interface FilaStockValor {
  almacen_id: string;
  cantidad: number;
  producto: { costo_promedio: number } | null;
}

/** Acceso a datos de `almacenes`. */
@Injectable()
export class AlmacenesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(token: string, empresaId: string): Promise<AlmacenEntity[]> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('almacenes')
      .select(COLUMNAS_ALMACEN)
      .eq('empresa_id', empresaId)
      .order('codigo');
    return (datosOError(r) as AlmacenEntity[] | null) ?? [];
  }

  /** Stock con costo, para valorizar cada almacén. */
  async stockValorizado(
    token: string,
    empresaId: string,
  ): Promise<FilaStockValor[]> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('stock')
      .select('almacen_id, cantidad, producto:productos(costo_promedio)')
      .eq('empresa_id', empresaId)
      .gt('cantidad', 0);
    return (datosOError(r) as unknown as FilaStockValor[] | null) ?? [];
  }

  async crear(
    token: string,
    fila: Partial<AlmacenEntity>,
  ): Promise<AlmacenEntity> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('almacenes')
      .insert(fila)
      .select(COLUMNAS_ALMACEN)
      .single<AlmacenEntity>();
    return datosOError(r);
  }

  async actualizar(
    token: string,
    empresaId: string,
    id: string,
    cambios: Partial<AlmacenEntity>,
  ): Promise<AlmacenEntity> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('almacenes')
      .update(cambios)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select(COLUMNAS_ALMACEN)
      .single<AlmacenEntity>();
    return datosOError(r);
  }

  /** DELETE real. Devuelve false si no existía. Si tiene historial, la FK lanza 23503 (→ 409). */
  async eliminar(
    token: string,
    empresaId: string,
    id: string,
  ): Promise<boolean> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('almacenes')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select('id');
    return ((datosOError(r) as { id: string }[] | null) ?? []).length > 0;
  }
}
