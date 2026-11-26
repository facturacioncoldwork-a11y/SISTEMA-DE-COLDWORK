import { Injectable } from '@nestjs/common';
import { datosOError } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';
import {
  SELECT_ORDEN_COMPRA,
  type EstadoOc,
  type FilaOrdenCompra,
  type CambiosOrdenCompra,
  type FilaProyectoCompra,
} from '../entities/index.js';

/** Acceso a datos de órdenes de compra. Las escrituras van por RPC (atómicas en SQL). */
@Injectable()
export class OrdenesCompraRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(
    token: string,
    empresaId: string,
    estado?: EstadoOc,
  ): Promise<FilaOrdenCompra[]> {
    let q = this.supabase
      .paraUsuario(token)
      .from('ordenes_compra')
      .select(SELECT_ORDEN_COMPRA)
      .eq('empresa_id', empresaId);
    if (estado) q = q.eq('estado', estado);
    const r = await q.order('numero', { ascending: false }).limit(300);
    return (datosOError(r) as unknown as FilaOrdenCompra[] | null) ?? [];
  }

  async obtener(
    token: string,
    empresaId: string,
    id: string,
  ): Promise<FilaOrdenCompra> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('ordenes_compra')
      .select(SELECT_ORDEN_COMPRA)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single();
    return datosOError(r) as unknown as FilaOrdenCompra;
  }

  async crear(
    token: string,
    empresaId: string,
    datos: unknown,
  ): Promise<string> {
    const r = await this.supabase
      .paraUsuario(token)
      .rpc('crear_orden_compra', { p_empresa: empresaId, p_datos: datos });
    return datosOError(r) as string;
  }

  async proyectos(
    token: string,
    empresaId: string,
  ): Promise<FilaProyectoCompra[]> {
    const r = await this.supabase
      .paraUsuario(token)
      .rpc('proyectos_para_compras', { p_empresa: empresaId });
    // Sin la migración de pagos/proyectos todavía: lista vacía en vez de error
    if (r.error?.code === 'PGRST202' || r.error?.code === '42883') return [];
    return (datosOError(r) as FilaProyectoCompra[] | null) ?? [];
  }

  async cambiarEstado(
    token: string,
    empresaId: string,
    id: string,
    estado: EstadoOc,
  ): Promise<void> {
    datosOError(
      await this.supabase.paraUsuario(token).rpc('cambiar_estado_oc', {
        p_empresa: empresaId,
        p_orden: id,
        p_estado: estado,
      }),
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
      .from('ordenes_compra')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select('id');
    return ((datosOError(r) as { id: string }[] | null) ?? []).length > 0;
  }

  async actualizar(
    token: string,
    empresaId: string,
    id: string,
    cambios: CambiosOrdenCompra,
  ): Promise<void> {
    datosOError(
      await this.supabase
        .paraUsuario(token)
        .from('ordenes_compra')
        .update(cambios)
        .eq('empresa_id', empresaId)
        .eq('id', id)
        .select('id')
        .single(),
    );
  }

  /** Solo en borrador (lo valida la función SQL). */
  async reemplazarItems(
    token: string,
    empresaId: string,
    id: string,
    items: unknown,
  ): Promise<void> {
    datosOError(
      await this.supabase.paraUsuario(token).rpc('reemplazar_items_oc', {
        p_empresa: empresaId,
        p_orden: id,
        p_items: items,
      }),
    );
  }
}
