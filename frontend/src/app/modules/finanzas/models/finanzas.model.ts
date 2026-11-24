/** Modelos del módulo Finanzas (mismos nombres que la API /api/v1/finanzas). */

export type Operacion = 'venta' | 'compra';
export type Moneda = 'PEN' | 'USD';
export type TipoDocumentoIdentidad = 'RUC' | 'DNI' | 'CE' | 'OTRO';

// ─── Clientes y proveedores ──────────────────────────────────────

export interface Tercero {
  id: string;
  tipoDocumento: TipoDocumentoIdentidad;
  numeroDocumento: string;
  razonSocial: string;
  esCliente: boolean;
  esProveedor: boolean;
  rubro?: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  diasCredito: number;
  activo: boolean;
}

export type GuardarTercero = Omit<Tercero, 'id'>;

// ─── Comprobantes ────────────────────────────────────────────────

export interface Comprobante {
  id: string;
  operacion: Operacion;
  terceroId: string;
  terceroNombre: string;
  terceroTipoDocumento: string;
  terceroDocumento: string;
  /** Tabla 10 SUNAT: 01 factura, 03 boleta, 07 nota de crédito, 08 nota de débito… */
  tipoDoc: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  fechaVencimiento: string;
  moneda: Moneda;
  tipoCambio?: number;
  baseGravada: number;
  noGravada: number;
  igv: number;
  total: number;
  retencionRenta: number;
  detraccionPorcentaje: number;
  detraccionMonto: number;
  cuentaContable: string;
  glosa?: string;
  referenciaId?: string;
  estado: 'registrado' | 'anulado';
  motivoAnulacion?: string;
  asientoId?: string;
  pagado: number;
  notasCredito: number;
  pendiente: number;
  creadoPorNombre?: string;
  creadoEn: string;
}

/** Cuenta por cobrar o por pagar: comprobante con su atraso. */
export interface Pendiente extends Comprobante {
  diasVencido: number;
  tramo: 'por_vencer' | '1-30' | '31-60' | '61-90' | 'mas_90';
}

export interface NuevoComprobante {
  operacion: Operacion;
  terceroId: string;
  tipoDoc: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  fechaVencimiento?: string;
  moneda: Moneda;
  tipoCambio?: number;
  baseGravada: number;
  noGravada: number;
  igv: number;
  retencionRenta?: number;
  detraccionPorcentaje?: number;
  cuentaContable: string;
  glosa?: string;
  referenciaId?: string;
}

// ─── Caja y bancos ───────────────────────────────────────────────

export type TipoCuenta = 'caja' | 'banco' | 'detracciones';

export interface CuentaFinanciera {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  banco?: string;
  numero?: string;
  moneda: Moneda;
  cuentaContable: string;
  activa: boolean;
  saldo: number;
}

export type GuardarCuenta = Omit<CuentaFinanciera, 'id' | 'saldo'>;

export type TipoMovimiento = 'cobro' | 'pago' | 'ingreso' | 'egreso' | 'transferencia';
export type MedioPago = 'efectivo' | 'transferencia' | 'deposito' | 'cheque' | 'tarjeta' | 'yape_plin' | 'otro';

export interface Movimiento {
  id: string;
  cuentaId: string;
  cuentaNombre: string;
  moneda: Moneda;
  fecha: string;
  tipo: TipoMovimiento;
  comprobanteId?: string;
  comprobante?: string;
  terceroNombre?: string;
  cuentaDestinoId?: string;
  cuentaDestinoNombre?: string;
  contrapartida?: string;
  monto: number;
  tipoCambio?: number;
  medio: MedioPago;
  referencia?: string;
  glosa?: string;
  estado: 'registrado' | 'anulado';
  asientoId?: string;
  creadoPorNombre?: string;
}

export interface NuevoMovimiento {
  cuentaId: string;
  fecha: string;
  tipo: TipoMovimiento;
  comprobanteId?: string;
  cuentaDestinoId?: string;
  contrapartida?: string;
  monto: number;
  tipoCambio?: number;
  medio: MedioPago;
  referencia?: string;
  glosa?: string;
}

// ─── Resumen y reportes ──────────────────────────────────────────

export interface ResumenFinanzas {
  disponible: number;
  disponibleUsd: number;
  detracciones: number;
  porCobrar: number;
  porCobrarVencido: number;
  porPagar: number;
  porPagarVencido: number;
  ventasMes: number;
  comprasMes: number;
}

export interface SaldoContable {
  cuenta: string;
  debe: number;
  haber: number;
}
