import { Injectable } from '@nestjs/common';
import { datosOError } from '../../../common/index.js';
import { SupabaseService } from '../../../database/supabase/supabase.service.js';

type Fila = Record<string, unknown>;

/**
 * Acceso a datos de finanzas. Lee con RLS (token del usuario) desde vistas que ya traen
 * saldos y nombres; toda escritura de documentos pasa por funciones SQL con las reglas.
 */
@Injectable()
export class FinanzasRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private db(token: string) {
    return this.supabase.paraUsuario(token);
  }

  // ─── Clientes y proveedores ────────────────────────────────────

  async terceros(token: string, empresaId: string): Promise<Fila[]> {
    const r = await this.db(token)
      .from('terceros')
      .select(
        'id, tipo_documento, numero_documento, razon_social, es_cliente, es_proveedor, rubro, contacto, ' +
          'telefono, correo, direccion, dias_credito, activo',
      )
      .eq('empresa_id', empresaId)
      .order('razon_social')
      .limit(5000);
    return (datosOError(r) as unknown as Fila[] | null) ?? [];
  }

  async crearTercero(token: string, fila: Fila): Promise<Fila> {
    const r = await this.db(token).from('terceros').insert(fila).select('id').single();
    return datosOError(r) as Fila;
  }

  async actualizarTercero(token: string, empresaId: string, id: string, fila: Fila): Promise<void> {
    const r = await this.db(token).from('terceros').update(fila).eq('empresa_id', empresaId).eq('id', id).select('id');
    if (!(datosOError(r) as Fila[] | null)?.length) throw new Error('NO_ENCONTRADO');
  }

  async eliminarTercero(token: string, empresaId: string, id: string): Promise<boolean> {
    const r = await this.db(token).from('terceros').delete().eq('empresa_id', empresaId).eq('id', id).select('id');
    return ((datosOError(r) as Fila[] | null) ?? []).length > 0;
  }

  // ─── Comprobantes ─────────────────────────────────────────────

  async comprobantes(
    token: string,
    empresaId: string,
    filtro: { operacion?: string; desde?: string; hasta?: string; soloPendientes?: boolean },
  ): Promise<Fila[]> {
    let q = this.db(token).from('fin_comprobantes_detalle').select('*').eq('empresa_id', empresaId);
    if (filtro.operacion) q = q.eq('operacion', filtro.operacion);
    if (filtro.desde) q = q.gte('fecha_emision', filtro.desde);
    if (filtro.hasta) q = q.lte('fecha_emision', filtro.hasta);
    if (filtro.soloPendientes) q = q.gt('pendiente', 0);
    const r = await q.order('fecha_emision', { ascending: false }).order('creado_en', { ascending: false }).limit(5000);
    return (datosOError(r) as Fila[] | null) ?? [];
  }

  async registrarComprobante(token: string, empresaId: string, datos: unknown): Promise<string> {
    const r = await this.db(token).rpc('fin_registrar_comprobante', { p_empresa: empresaId, p_datos: datos });
    return datosOError(r) as string;
  }

  async anularComprobante(token: string, empresaId: string, id: string, motivo: string): Promise<void> {
    const r = await this.db(token).rpc('fin_anular_comprobante', { p_empresa: empresaId, p_id: id, p_motivo: motivo });
    datosOError(r);
  }

  // ─── Caja y bancos ────────────────────────────────────────────

  async cuentas(token: string, empresaId: string): Promise<Fila[]> {
    const r = await this.db(token).from('fin_saldos_cuentas').select('*').eq('empresa_id', empresaId).order('nombre');
    return (datosOError(r) as Fila[] | null) ?? [];
  }

  async guardarCuenta(token: string, empresaId: string, id: string | null, datos: unknown): Promise<string> {
    const r = await this.db(token).rpc('fin_guardar_cuenta', { p_empresa: empresaId, p_id: id, p_datos: datos });
    return datosOError(r) as string;
  }

  async movimientos(
    token: string,
    empresaId: string,
    filtro: { cuentaId?: string; desde?: string; hasta?: string },
  ): Promise<Fila[]> {
    let q = this.db(token).from('fin_movimientos_detalle').select('*').eq('empresa_id', empresaId);
    if (filtro.cuentaId) q = q.or(`cuenta_id.eq.${filtro.cuentaId},cuenta_destino_id.eq.${filtro.cuentaId}`);
    if (filtro.desde) q = q.gte('fecha', filtro.desde);
    if (filtro.hasta) q = q.lte('fecha', filtro.hasta);
    const r = await q.order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(3000);
    return (datosOError(r) as Fila[] | null) ?? [];
  }

  async registrarMovimiento(token: string, empresaId: string, datos: unknown): Promise<string> {
    const r = await this.db(token).rpc('fin_registrar_movimiento', { p_empresa: empresaId, p_datos: datos });
    return datosOError(r) as string;
  }

  async anularMovimiento(token: string, empresaId: string, id: string, motivo: string): Promise<void> {
    const r = await this.db(token).rpc('fin_anular_movimiento', { p_empresa: empresaId, p_id: id, p_motivo: motivo });
    datosOError(r);
  }

  // ─── Reportes ─────────────────────────────────────────────────

  async saldosContables(
    token: string,
    empresaId: string,
    desde: string | null,
    hasta: string,
  ): Promise<{ cuenta: string; debe: number; haber: number }[]> {
    const r = await this.db(token).rpc('conta_saldos', { p_empresa: empresaId, p_desde: desde, p_hasta: hasta });
    return ((datosOError(r) as Fila[] | null) ?? []).map((f) => ({
      cuenta: typeof f['cuenta'] === 'string' ? f['cuenta'] : '',
      debe: Number(f['debe']),
      haber: Number(f['haber']),
    }));
  }
}
