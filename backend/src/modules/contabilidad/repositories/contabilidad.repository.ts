import { Injectable } from '@nestjs/common';
import { datosOError } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';
import {
  COLUMNAS_ACTIVIDAD,
  COLUMNAS_ASIENTO,
  COLUMNAS_CONFIG,
  type AccionEstado,
  type ActividadEntity,
  type AsientoEntity,
  type ConfigEntity,
} from '../entities/contabilidad.entity.js';

/**
 * Acceso a datos de contabilidad. Lee con RLS (token del usuario);
 * toda escritura pasa por funciones SQL que aplican las reglas contables.
 */
@Injectable()
export class ContabilidadRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async asientosDelPeriodo(token: string, empresaId: string, periodo: string): Promise<AsientoEntity[]> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('conta_asientos')
      .select(COLUMNAS_ASIENTO)
      .eq('empresa_id', empresaId)
      .eq('periodo', periodo)
      .order('numero', { ascending: false });
    return (datosOError(r) as unknown as AsientoEntity[] | null) ?? [];
  }

  /** Asientos esperando aprobación, de cualquier periodo. */
  async porAprobar(token: string, empresaId: string): Promise<AsientoEntity[]> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('conta_asientos')
      .select(COLUMNAS_ASIENTO)
      .eq('empresa_id', empresaId)
      .eq('estado', 'por_aprobar')
      .order('creado_en');
    return (datosOError(r) as unknown as AsientoEntity[] | null) ?? [];
  }

  async asiento(token: string, empresaId: string, id: string): Promise<AsientoEntity> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('conta_asientos')
      .select(COLUMNAS_ASIENTO)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single<AsientoEntity>();
    return datosOError(r);
  }

  /** Periodos con asientos (los más recientes primero). */
  async periodos(token: string, empresaId: string): Promise<string[]> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('conta_asientos')
      .select('periodo')
      .eq('empresa_id', empresaId)
      .order('periodo', { ascending: false })
      .limit(1000);
    const filas = (datosOError(r) as { periodo: string }[] | null) ?? [];
    return [...new Set(filas.map((f) => f.periodo))];
  }

  async actividad(token: string, empresaId: string, limite: number): Promise<ActividadEntity[]> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('conta_actividad')
      .select(COLUMNAS_ACTIVIDAD)
      .eq('empresa_id', empresaId)
      .order('fecha', { ascending: false })
      .limit(limite);
    return (datosOError(r) as ActividadEntity[] | null) ?? [];
  }

  async config(token: string, empresaId: string): Promise<ConfigEntity | null> {
    const r = await this.supabase
      .paraUsuario(token)
      .from('conta_config')
      .select(COLUMNAS_CONFIG)
      .eq('empresa_id', empresaId)
      .maybeSingle<ConfigEntity>();
    return datosOError(r);
  }

  async esAprobador(token: string, empresaId: string): Promise<boolean> {
    const r = await this.supabase.paraUsuario(token).rpc('conta_es_aprobador', { p_empresa: empresaId });
    return datosOError(r) as boolean;
  }

  // ─── Escritura (funciones SQL) ─────────────────────────────────

  async guardarAsiento(
    token: string,
    empresaId: string,
    id: string | null,
    datos: unknown,
    confirmar: boolean,
  ): Promise<string> {
    const r = await this.supabase.paraUsuario(token).rpc('conta_guardar_asiento', {
      p_empresa: empresaId,
      p_id: id,
      p_datos: datos,
      p_confirmar: confirmar,
    });
    return datosOError(r) as string;
  }

  async cambiarEstado(
    token: string,
    empresaId: string,
    id: string,
    accion: AccionEstado,
    comentario?: string,
  ): Promise<void> {
    const r = await this.supabase.paraUsuario(token).rpc('conta_cambiar_estado', {
      p_empresa: empresaId,
      p_id: id,
      p_accion: accion,
      p_comentario: comentario ?? null,
    });
    datosOError(r);
  }

  async guardarConfig(token: string, empresaId: string, datos: unknown): Promise<void> {
    const r = await this.supabase
      .paraUsuario(token)
      .rpc('conta_guardar_config', { p_empresa: empresaId, p_datos: datos });
    datosOError(r);
  }
}
