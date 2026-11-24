import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { EmpresaActual, UsuarioActual } from '../../../common/index.js';
import { problemaDocumento } from '../../../common/utils/documentos-peru.js';
import type { AnularDto, ComprobanteDto, CuentaDto, MovimientoDto, TerceroDto } from '../dto/finanzas.dto.js';
import { FinanzasRepository } from '../repositories/finanzas.repository.js';

type Fila = Record<string, unknown>;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Texto seguro desde una fila de la base de datos. */
const txt = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';
const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const s = (v: unknown) => (v === null || v === undefined ? undefined : txt(v));

/** Días entre dos fechas AAAA-MM-DD (positivo = ya pasó). */
export function diasVencido(vencimiento: string, hoy: string): number {
  return Math.round((Date.parse(hoy) - Date.parse(vencimiento)) / 86_400_000);
}

/** Tramo de antigüedad de una deuda (para cobranza). */
export function tramoAntiguedad(dias: number): 'por_vencer' | '1-30' | '31-60' | '61-90' | 'mas_90' {
  if (dias <= 0) return 'por_vencer';
  if (dias <= 30) return '1-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  return 'mas_90';
}

/**
 * Reglas de la API de finanzas. Las reglas contables y de dinero (IGV, saldos, duplicados,
 * permisos por área, asientos automáticos) las aplica la base de datos.
 */
@Injectable()
export class FinanzasService {
  constructor(private readonly repo: FinanzasRepository) {}

  // ─── Clientes y proveedores ────────────────────────────────────

  async terceros(u: UsuarioActual, e: EmpresaActual) {
    return (await this.repo.terceros(u.token, e.id)).map(aTercero);
  }

  async crearTercero(u: UsuarioActual, e: EmpresaActual, dto: TerceroDto) {
    this.validarTercero(dto);
    try {
      const { id } = await this.repo.crearTercero(u.token, { empresa_id: e.id, ...filaTercero(dto) });
      return { id };
    } catch (err) {
      if (err instanceof ConflictException) throw new ConflictException('Ya existe un cliente o proveedor con ese documento');
      throw err;
    }
  }

  async actualizarTercero(u: UsuarioActual, e: EmpresaActual, id: string, dto: TerceroDto) {
    this.validarTercero(dto);
    try {
      await this.repo.actualizarTercero(u.token, e.id, id, filaTercero(dto));
    } catch (err) {
      if ((err as Error).message === 'NO_ENCONTRADO') throw new NotFoundException('No encontrado');
      if (err instanceof ConflictException) throw new ConflictException('Ya existe un cliente o proveedor con ese documento');
      throw err;
    }
  }

  async eliminarTercero(u: UsuarioActual, e: EmpresaActual, id: string) {
    try {
      const ok = await this.repo.eliminarTercero(u.token, e.id, id);
      if (!ok) throw new NotFoundException('No encontrado');
    } catch (err) {
      if (err instanceof ConflictException) {
        throw new ConflictException('Tiene comprobantes u órdenes registradas: desactívalo en lugar de eliminarlo.');
      }
      throw err;
    }
  }

  private validarTercero(dto: TerceroDto) {
    const problema = problemaDocumento(dto.tipoDocumento, dto.numeroDocumento);
    if (problema) throw new BadRequestException(problema);
    if (!dto.esCliente && !dto.esProveedor) throw new BadRequestException('Marca si es cliente, proveedor o ambos.');
  }

  // ─── Comprobantes ─────────────────────────────────────────────

  async comprobantes(u: UsuarioActual, e: EmpresaActual, operacion: string, desde?: string, hasta?: string) {
    this.validarOperacion(operacion);
    if ((desde && !FECHA.test(desde)) || (hasta && !FECHA.test(hasta))) throw new BadRequestException('Fecha inválida');
    return (await this.repo.comprobantes(u.token, e.id, { operacion, desde, hasta })).map(aComprobante);
  }

  /** Cuentas por cobrar (venta) o por pagar (compra): lo pendiente con su antigüedad. */
  async pendientes(u: UsuarioActual, e: EmpresaActual, operacion: string, hoy = fechaLima()) {
    this.validarOperacion(operacion);
    const filas = await this.repo.comprobantes(u.token, e.id, { operacion, soloPendientes: true });
    return filas
      .map(aComprobante)
      .map((c) => {
        const dias = diasVencido(c.fechaVencimiento, hoy);
        return { ...c, diasVencido: dias, tramo: tramoAntiguedad(dias) };
      })
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
  }

  registrarComprobante(u: UsuarioActual, e: EmpresaActual, dto: ComprobanteDto) {
    if (dto.tipoDoc === '07' && !dto.referenciaId) {
      throw new BadRequestException('La nota de crédito debe indicar qué comprobante corrige.');
    }
    return this.repo.registrarComprobante(u.token, e.id, dto).then((id) => ({ id }));
  }

  anularComprobante(u: UsuarioActual, e: EmpresaActual, id: string, dto: AnularDto) {
    return this.repo.anularComprobante(u.token, e.id, id, dto.motivo);
  }

  private validarOperacion(operacion: string) {
    if (!['venta', 'compra'].includes(operacion)) throw new BadRequestException('operacion: venta o compra');
  }

  // ─── Caja y bancos ────────────────────────────────────────────

  async cuentas(u: UsuarioActual, e: EmpresaActual) {
    return (await this.repo.cuentas(u.token, e.id)).map(aCuenta);
  }

  guardarCuenta(u: UsuarioActual, e: EmpresaActual, id: string | null, dto: CuentaDto) {
    return this.repo.guardarCuenta(u.token, e.id, id, dto).then((nuevoId) => ({ id: nuevoId }));
  }

  async movimientos(u: UsuarioActual, e: EmpresaActual, cuentaId?: string, desde?: string, hasta?: string) {
    if ((desde && !FECHA.test(desde)) || (hasta && !FECHA.test(hasta))) throw new BadRequestException('Fecha inválida');
    return (await this.repo.movimientos(u.token, e.id, { cuentaId, desde, hasta })).map(aMovimiento);
  }

  registrarMovimiento(u: UsuarioActual, e: EmpresaActual, dto: MovimientoDto) {
    if ((dto.tipo === 'cobro' || dto.tipo === 'pago') && !dto.comprobanteId) {
      throw new BadRequestException('Elige el comprobante que se cobra o paga.');
    }
    if (dto.tipo === 'transferencia' && !dto.cuentaDestinoId) throw new BadRequestException('Elige la cuenta de destino.');
    return this.repo.registrarMovimiento(u.token, e.id, dto).then((id) => ({ id }));
  }

  anularMovimiento(u: UsuarioActual, e: EmpresaActual, id: string, dto: AnularDto) {
    return this.repo.anularMovimiento(u.token, e.id, id, dto.motivo);
  }

  // ─── Resumen de finanzas (tarjetas del panel) ─────────────────

  async resumen(u: UsuarioActual, e: EmpresaActual, hoy = fechaLima()) {
    const mes = hoy.slice(0, 7);
    const [cuentas, cobrar, pagar, ventasMes, comprasMes] = await Promise.all([
      this.cuentas(u, e).catch(() => []),
      this.pendientes(u, e, 'venta', hoy).catch(() => []),
      this.pendientes(u, e, 'compra', hoy).catch(() => []),
      this.repo.comprobantes(u.token, e.id, { operacion: 'venta', desde: `${mes}-01`, hasta: hoy }).catch(() => []),
      this.repo.comprobantes(u.token, e.id, { operacion: 'compra', desde: `${mes}-01`, hasta: hoy }).catch(() => []),
    ]);
    const enSoles = (c: { moneda: string; tipoCambio?: number; pendiente: number }) =>
      c.moneda === 'USD' ? c.pendiente * (c.tipoCambio ?? 0) : c.pendiente;
    const totalMes = (filas: Fila[]) =>
      filas
        .map(aComprobante)
        .filter((c) => c.estado === 'registrado')
        .reduce((t, c) => t + (c.tipoDoc === '07' ? -1 : 1) * (c.baseGravada + c.noGravada) * (c.tipoCambio ?? 1), 0);

    return {
      disponible: redondear(
        cuentas.filter((c) => c.tipo !== 'detracciones').reduce((t, c) => t + c.saldo * (c.moneda === 'USD' ? 0 : 1), 0),
      ),
      disponibleUsd: redondear(cuentas.filter((c) => c.moneda === 'USD').reduce((t, c) => t + c.saldo, 0)),
      detracciones: redondear(cuentas.filter((c) => c.tipo === 'detracciones').reduce((t, c) => t + c.saldo, 0)),
      porCobrar: redondear(cobrar.reduce((t, c) => t + enSoles(c), 0)),
      porCobrarVencido: redondear(cobrar.filter((c) => c.diasVencido > 0).reduce((t, c) => t + enSoles(c), 0)),
      porPagar: redondear(pagar.reduce((t, c) => t + enSoles(c), 0)),
      porPagarVencido: redondear(pagar.filter((c) => c.diasVencido > 0).reduce((t, c) => t + enSoles(c), 0)),
      ventasMes: redondear(totalMes(ventasMes)),
      comprasMes: redondear(totalMes(comprasMes)),
    };
  }

  // ─── Reportes ─────────────────────────────────────────────────

  saldosContables(u: UsuarioActual, e: EmpresaActual, desde: string | undefined, hasta: string) {
    if (!FECHA.test(hasta) || (desde && !FECHA.test(desde))) throw new BadRequestException('Fecha inválida');
    return this.repo.saldosContables(u.token, e.id, desde ?? null, hasta);
  }
}

// ─── Fechas y números ──────────────────────────────────────────

/** Hoy en Lima (UTC-5, sin horario de verano): AAAA-MM-DD. */
export function fechaLima(ahora = new Date()): string {
  return new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

function redondear(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

// ─── Filas → respuesta (camelCase) ─────────────────────────────

function filaTercero(dto: TerceroDto): Fila {
  const vacio = (v?: string) => (v?.trim() ? v.trim() : null);
  return {
    tipo_documento: dto.tipoDocumento,
    numero_documento: dto.numeroDocumento.toUpperCase(),
    razon_social: dto.razonSocial,
    es_cliente: dto.esCliente,
    es_proveedor: dto.esProveedor,
    rubro: vacio(dto.rubro),
    contacto: vacio(dto.contacto),
    telefono: vacio(dto.telefono),
    correo: vacio(dto.correo),
    direccion: vacio(dto.direccion),
    dias_credito: dto.diasCredito,
    ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
  };
}

function aTercero(f: Fila) {
  return {
    id: txt(f['id']),
    tipoDocumento: txt(f['tipo_documento']),
    numeroDocumento: txt(f['numero_documento']),
    razonSocial: txt(f['razon_social']),
    esCliente: Boolean(f['es_cliente']),
    esProveedor: Boolean(f['es_proveedor']),
    rubro: s(f['rubro']),
    contacto: s(f['contacto']),
    telefono: s(f['telefono']),
    correo: s(f['correo']),
    direccion: s(f['direccion']),
    diasCredito: n(f['dias_credito']),
    activo: Boolean(f['activo']),
  };
}

export function aComprobante(f: Fila) {
  return {
    id: txt(f['id']),
    operacion: txt(f['operacion']) as 'venta' | 'compra',
    terceroId: txt(f['tercero_id']),
    terceroNombre: txt(f['tercero_nombre']),
    terceroTipoDocumento: txt(f['tercero_tipo_documento']),
    terceroDocumento: txt(f['tercero_documento']),
    tipoDoc: txt(f['tipo_doc']),
    serie: txt(f['serie']),
    numero: txt(f['numero']),
    fechaEmision: txt(f['fecha_emision']),
    fechaVencimiento: txt(f['fecha_vencimiento']),
    moneda: txt(f['moneda']),
    tipoCambio: f['tipo_cambio'] === null || f['tipo_cambio'] === undefined ? undefined : n(f['tipo_cambio']),
    baseGravada: n(f['base_gravada']),
    noGravada: n(f['no_gravada']),
    igv: n(f['igv']),
    total: n(f['total']),
    retencionRenta: n(f['retencion_renta']),
    detraccionPorcentaje: n(f['detraccion_porcentaje']),
    detraccionMonto: n(f['detraccion_monto']),
    cuentaContable: txt(f['cuenta_contable']),
    glosa: s(f['glosa']),
    referenciaId: s(f['referencia_id']),
    estado: txt(f['estado']) as 'registrado' | 'anulado',
    motivoAnulacion: s(f['motivo_anulacion']),
    asientoId: s(f['asiento_id']),
    pagado: n(f['pagado']),
    notasCredito: n(f['notas_credito']),
    pendiente: n(f['pendiente']),
    creadoPorNombre: s(f['creado_por_nombre']),
    creadoEn: txt(f['creado_en']),
  };
}

function aCuenta(f: Fila) {
  return {
    id: txt(f['id']),
    nombre: txt(f['nombre']),
    tipo: txt(f['tipo']) as 'caja' | 'banco' | 'detracciones',
    banco: s(f['banco']),
    numero: s(f['numero']),
    moneda: txt(f['moneda']),
    cuentaContable: txt(f['cuenta_contable']),
    activa: Boolean(f['activa']),
    saldo: n(f['saldo']),
  };
}

function aMovimiento(f: Fila) {
  return {
    id: txt(f['id']),
    cuentaId: txt(f['cuenta_id']),
    cuentaNombre: txt(f['cuenta_nombre']),
    moneda: (txt(f['moneda']) || 'PEN'),
    fecha: txt(f['fecha']),
    tipo: txt(f['tipo']),
    comprobanteId: s(f['comprobante_id']),
    comprobante: f['comprobante_serie'] ? `${txt(f['comprobante_serie'])}-${txt(f['comprobante_numero'])}` : undefined,
    terceroNombre: s(f['tercero_nombre']),
    cuentaDestinoId: s(f['cuenta_destino_id']),
    cuentaDestinoNombre: s(f['cuenta_destino_nombre']),
    contrapartida: s(f['contrapartida']),
    monto: n(f['monto']),
    tipoCambio: f['tipo_cambio'] === null || f['tipo_cambio'] === undefined ? undefined : n(f['tipo_cambio']),
    medio: txt(f['medio']),
    referencia: s(f['referencia']),
    glosa: s(f['glosa']),
    estado: txt(f['estado']),
    asientoId: s(f['asiento_id']),
    creadoPorNombre: s(f['creado_por_nombre']),
  };
}
