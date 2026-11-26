import { Injectable } from '@nestjs/common';
import { datosOError } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';

export type Fila = Record<string, unknown>;

/** Tope de filas por lista: las pantallas muestran lo reciente y lo abierto (rápido con miles de registros). */
const TOPE = 1000;

/**
 * Acceso a Operaciones. Lee con RLS (token del usuario) y escribe SOLO por funciones SQL
 * que validan área, empresa, estado y versión.
 */
@Injectable()
export class OperacionesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private db(token: string) {
    return this.supabase.paraUsuario(token);
  }

  async rpc<T = unknown>(token: string, funcion: string, args: Record<string, unknown>): Promise<T> {
    return datosOError(await this.db(token).rpc(funcion, args)) as T;
  }

  async directorio(token: string, empresaId: string): Promise<Fila[]> {
    return (await this.rpc<Fila[] | null>(token, 'empresa_directorio', { p_empresa: empresaId })) ?? [];
  }

  async cotizaciones(token: string, empresaId: string, desde: string): Promise<Fila[]> {
    const r = await this.db(token)
      .from('ope_cotizaciones')
      .select('id, serie, numero, cliente_id, proyecto, fecha, validez_dias, moneda, estado, expediente_id, motivo_rechazo, datos, version')
      .eq('empresa_id', empresaId)
      .or(`fecha.gte.${desde},estado.in.(borrador,enviada)`)
      .order('fecha', { ascending: false })
      .limit(TOPE);
    return (datosOError(r) as unknown as Fila[] | null) ?? [];
  }

  async expedientes(token: string, empresaId: string, desde: string): Promise<Fila[]> {
    const r = await this.db(token)
      .from('ope_expedientes')
      .select('id, codigo, cliente_id, titulo, responsable_id, etapa, creado, datos, version')
      .eq('empresa_id', empresaId)
      .or(`creado.gte.${desde},etapa.neq.cobrado`)
      .order('actualizado_en', { ascending: false })
      .limit(TOPE);
    return (datosOError(r) as unknown as Fila[] | null) ?? [];
  }

  async historial(token: string, empresaId: string, expedienteId: string): Promise<Fila[]> {
    const r = await this.db(token)
      .from('ope_expediente_historial')
      .select('autor_nombre, texto, creado_en')
      .eq('empresa_id', empresaId)
      .eq('expediente_id', expedienteId)
      .order('creado_en', { ascending: false })
      .limit(500);
    return (datosOError(r) as unknown as Fila[] | null) ?? [];
  }

  async equipos(token: string, empresaId: string): Promise<Fila[]> {
    const r = await this.db(token)
      .from('ope_equipos')
      .select('id, cliente_id, codigo, tipo, marca, modelo, serie, refrigerante, capacidad, ubicacion')
      .eq('empresa_id', empresaId)
      .order('codigo')
      .limit(5000);
    return (datosOError(r) as unknown as Fila[] | null) ?? [];
  }

  async ordenes(token: string, empresaId: string, desde: string): Promise<Fila[]> {
    const r = await this.db(token)
      .from('ope_ordenes')
      .select('id, numero, cliente_id, equipo_id, expediente_id, tipo, prioridad, tecnicos, fecha, hora, descripcion, estado, informe, version')
      .eq('empresa_id', empresaId)
      .or(`fecha.gte.${desde},estado.neq.cerrada`)
      .order('fecha', { ascending: false })
      .limit(TOPE);
    return (datosOError(r) as unknown as Fila[] | null) ?? [];
  }

  async mensajes(token: string, empresaId: string, ordenId: string): Promise<Fila[]> {
    const r = await this.db(token)
      .from('ope_orden_mensajes')
      .select('autor_id, autor_nombre, texto, creado_en')
      .eq('empresa_id', empresaId)
      .eq('orden_id', ordenId)
      .order('creado_en', { ascending: true })
      .limit(500);
    return (datosOError(r) as unknown as Fila[] | null) ?? [];
  }
}
