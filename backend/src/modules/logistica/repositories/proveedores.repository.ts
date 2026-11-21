import { Injectable } from '@nestjs/common';
import { datosOError } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';
import { COLUMNAS_TERCERO, type TerceroEntity } from '../entities/index.js';

/** Acceso a datos de `terceros` filtrando proveedores. */
@Injectable()
export class ProveedoresRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(token: string, empresaId: string): Promise<TerceroEntity[]> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('terceros')
      .select(COLUMNAS_TERCERO)
      .eq('empresa_id', empresaId)
      .eq('es_proveedor', true)
      .order('razon_social');
    return (datosOError(r) as TerceroEntity[] | null) ?? [];
  }

  async crear(
    token: string,
    fila: Partial<TerceroEntity>,
  ): Promise<TerceroEntity> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('terceros')
      .insert(fila)
      .select(COLUMNAS_TERCERO)
      .single<TerceroEntity>();
    return datosOError(r);
  }

  async actualizar(
    token: string,
    empresaId: string,
    id: string,
    cambios: Partial<TerceroEntity>,
  ): Promise<TerceroEntity> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('terceros')
      .update(cambios)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select(COLUMNAS_TERCERO)
      .single<TerceroEntity>();
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
      .from('terceros')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select('id');
    return ((datosOError(r) as { id: string }[] | null) ?? []).length > 0;
  }
}
