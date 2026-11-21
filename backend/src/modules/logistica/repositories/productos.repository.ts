import { Injectable } from '@nestjs/common';
import { datosOError } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';
import {
  COLUMNAS_PRODUCTO,
  type FilaProductoStock,
  type MovimientoEntity,
  type ProductoEntity,
} from '../entities/index.js';

/** Acceso a datos de `productos`, `stock` y `movimientos`. Solo consultas, sin reglas de negocio. */
@Injectable()
export class ProductosRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(token: string, empresaId: string): Promise<FilaProductoStock[]> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('productos')
      .select(`${COLUMNAS_PRODUCTO}, stock(almacen_id, cantidad)`)
      .eq('empresa_id', empresaId)
      .order('nombre');
    return (datosOError(r) as FilaProductoStock[] | null) ?? [];
  }

  async obtener(
    token: string,
    empresaId: string,
    id: string,
  ): Promise<FilaProductoStock> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('productos')
      .select(`${COLUMNAS_PRODUCTO}, stock(almacen_id, cantidad)`)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single<FilaProductoStock>();
    return datosOError(r);
  }

  async crear(token: string, fila: Partial<ProductoEntity>): Promise<string> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('productos')
      .insert(fila)
      .select('id')
      .single<{ id: string }>();
    return datosOError(r).id;
  }

  async actualizar(
    token: string,
    empresaId: string,
    id: string,
    cambios: Partial<ProductoEntity>,
  ): Promise<void> {
    datosOError(
      await this.supabase
        .paraUsuario(token)
        .from('productos')
        .update(cambios)
        .eq('empresa_id', empresaId)
        .eq('id', id)
        .select('id')
        .single(),
    );
  }

  async kardex(
    token: string,
    empresaId: string,
    productoId: string,
    limite = 200,
  ): Promise<MovimientoEntity[]> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('movimientos')
      .select(
        `id, producto_id, almacen_id, tipo, cantidad, costo_unitario, saldo, llegada_id, salida_id, fecha,
         llegada:llegadas(numero, guia_remision, proveedor:terceros(razon_social)),
         salida:salidas(numero, motivo, destino, responsable)`,
      )
      .eq('empresa_id', empresaId)
      .eq('producto_id', productoId)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })
      .limit(limite);
    return (datosOError(r) as unknown as MovimientoEntity[] | null) ?? [];
  }

  async resumen(token: string, empresaId: string): Promise<unknown> {
    return datosOError(
      await this.supabase
        .paraUsuario(token)
        .rpc('resumen_logistica', { p_empresa: empresaId }),
    );
  }

  /** DELETE real. Devuelve false si no existía. Si tiene historial, la FK lanza 23503 (→ 409). */
  async eliminar(
    token: string,
    empresaId: string,
    id: string,
  ): Promise<boolean> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('productos')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select('id');
    return ((datosOError(r) as { id: string }[] | null) ?? []).length > 0;
  }
}
