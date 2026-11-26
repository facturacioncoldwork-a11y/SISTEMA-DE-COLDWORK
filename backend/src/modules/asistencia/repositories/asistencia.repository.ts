import { Injectable } from '@nestjs/common';
import { datosOError } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';

type Fila = Record<string, unknown>;

const COLUMNAS_MARCA =
  'id, usuario_id, fecha, entrada, salida, metodo, metodo_salida, lugar, lugar_salida, salida_en_campo, motivo, pendiente, aprobado_por';

/**
 * Acceso a datos de asistencia. Lee con RLS (token del usuario): cada uno ve sus marcas y el
 * dueño/Personal ve todas. Toda escritura pasa por funciones SQL que validan.
 */
@Injectable()
export class AsistenciaRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private db(token: string) {
    return this.supabase.paraUsuario(token);
  }

  // ─── Tabletas de la oficina ───────────────────────────────────
  async tabletas(token: string, empresaId: string): Promise<Fila[]> {
    const r = await this.db(token)
      .from('asistencia_tabletas')
      .select('id, nombre, activa, creado_en, ultimo_uso')
      .eq('empresa_id', empresaId)
      .order('creado_en', { ascending: false })
      .limit(50);
    return (datosOError(r) as unknown as Fila[] | null) ?? [];
  }

  async crearTableta(token: string, empresaId: string, nombre: string): Promise<Fila> {
    return datosOError(await this.db(token).rpc('asis_crear_tableta', { p_empresa: empresaId, p_nombre: nombre })) as Fila;
  }

  async desactivarTableta(token: string, empresaId: string, id: string): Promise<void> {
    datosOError(await this.db(token).rpc('asis_desactivar_tableta', { p_empresa: empresaId, p_id: id }));
  }

  /** Sin sesión: la tablet solo presenta su token. */
  async codigoTableta(tokenTableta: string): Promise<Fila> {
    return datosOError(await this.supabase.publico().rpc('asis_codigo_tableta', { p_token: tokenTableta })) as Fila;
  }

  async horario(token: string, empresaId: string): Promise<Fila | null> {
    const r = await this.db(token).from('asistencia_horario').select('*').eq('empresa_id', empresaId).maybeSingle();
    return datosOError(r) as Fila | null;
  }

  async guardarHorario(token: string, empresaId: string, datos: unknown): Promise<void> {
    datosOError(await this.db(token).rpc('asis_guardar_horario', { p_empresa: empresaId, p_datos: datos }));
  }

  async marcas(token: string, empresaId: string, desde: string, hasta: string): Promise<Fila[]> {
    const r = await this.db(token)
      .from('asistencia_marcas')
      .select(COLUMNAS_MARCA)
      .eq('empresa_id', empresaId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false })
      .limit(10000);
    return (datosOError(r) as unknown as Fila[] | null) ?? [];
  }

  async ausencias(token: string, empresaId: string, desde: string, hasta: string): Promise<Fila[]> {
    const r = await this.db(token)
      .from('asistencia_ausencias')
      .select('id, usuario_id, fecha, tipo, sustento')
      .eq('empresa_id', empresaId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .limit(5000);
    return (datosOError(r) as unknown as Fila[] | null) ?? [];
  }

  async marcar(token: string, empresaId: string, datos: unknown): Promise<Fila> {
    return datosOError(await this.db(token).rpc('asis_marcar', { p_empresa: empresaId, p_datos: datos })) as Fila;
  }

  async marcarManual(token: string, empresaId: string, usuarioId: string, motivo: string): Promise<Fila> {
    return datosOError(
      await this.db(token).rpc('asis_marcar_manual', { p_empresa: empresaId, p_usuario: usuarioId, p_motivo: motivo }),
    ) as Fila;
  }

  async aprobar(token: string, empresaId: string, id: string): Promise<void> {
    datosOError(await this.db(token).rpc('asis_aprobar', { p_empresa: empresaId, p_id: id }));
  }

  async codigoOficina(token: string, empresaId: string): Promise<Fila> {
    return datosOError(await this.db(token).rpc('asis_codigo_oficina', { p_empresa: empresaId })) as Fila;
  }

  async registrarAusencia(token: string, empresaId: string, a: { usuarioId: string; fecha: string; tipo: string; sustento?: string }) {
    datosOError(
      await this.db(token).rpc('asis_registrar_ausencia', {
        p_empresa: empresaId,
        p_usuario: a.usuarioId,
        p_fecha: a.fecha,
        p_tipo: a.tipo,
        p_sustento: a.sustento ?? null,
      }),
    );
  }
}
