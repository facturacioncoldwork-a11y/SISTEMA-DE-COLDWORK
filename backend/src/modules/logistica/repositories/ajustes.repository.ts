import { BadRequestException, Injectable } from '@nestjs/common';
import { datosOError } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';
import type { AjustesLogisticaEntity } from '../entities/index.js';
import { columnaFaltante } from './ordenes-compra.repository.js';
import { faltaEnLaBase } from './productos.repository.js';

/** Acceso a datos de `logistica_ajustes`. */
@Injectable()
export class AjustesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async obtener(
    token: string,
    empresaId: string,
  ): Promise<AjustesLogisticaEntity | null> {
    const consultar = (columnas: string) =>
      this.supabase
        .paraUsuario(token)
        .from('logistica_ajustes')
        .select(columnas)
        .eq('empresa_id', empresaId)
        .maybeSingle<AjustesLogisticaEntity>();
    let r = await consultar(
      'empresa_id, meses_antiguedad, moneda, tipo_cambio_ref',
    );
    // Sin la migración de moneda (20261201000001): solo el límite de antigüedad
    if (columnaFaltante(r.error))
      r = await consultar('empresa_id, meses_antiguedad');
    // Sin la migración 0011 se usan los valores por defecto
    if (faltaEnLaBase(r.error)) return null;
    return datosOError(r) ?? null;
  }

  /** Cambia la moneda del inventario y convierte los costos ya registrados (solo el dueño). */
  async cambiarMoneda(
    token: string,
    empresaId: string,
    moneda: 'PEN' | 'USD',
    tipoCambio: number | null,
  ): Promise<number> {
    const r = await this.supabase
      .paraUsuario(token)
      .rpc('cambiar_moneda_inventario', {
        p_empresa: empresaId,
        p_moneda: moneda,
        p_tipo_cambio: tipoCambio,
      });
    if (
      r.error?.code === 'PGRST202' ||
      r.error?.code === '42883' ||
      columnaFaltante(r.error)
    ) {
      throw new BadRequestException(
        'Falta ejecutar en Supabase la migración 20261201000001_logistica_moneda.sql',
      );
    }
    return Number(datosOError(r) ?? 0);
  }

  /** Crea o actualiza la fila de la empresa (RLS: solo dueño o admin). */
  async guardar(token: string, fila: AjustesLogisticaEntity): Promise<void> {
    datosOError(
      await this.supabase
        .paraUsuario(token)
        .from('logistica_ajustes')
        .upsert(fila, { onConflict: 'empresa_id' })
        .select('empresa_id')
        .single(),
    );
  }
}
