/** Cotizaciones (propuesta técnico-económica) con el formato de COLD WORK. */

export type SerieCotizacion = 'PROY' | 'SERV';
export type EstadoCotizacion = 'borrador' | 'enviada' | 'aprobada' | 'rechazada';
export type MonedaCot = 'USD' | 'PEN';

export interface LineaCot {
  id: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio: number;
  /** Costo unitario interno (no sale en el PDF): sirve para ver el margen. */
  costo?: number | null;
}

export interface SeccionCot {
  id: string;
  titulo: string;
  lineas: LineaCot[];
}

/** Hito de pago: "1.er adelanto con la orden: 40 %". */
export interface HitoCot {
  id: string;
  descripcion: string;
  porcentaje: number;
}

export interface Cotizacion {
  id: string;
  serie: SerieCotizacion;
  numero: string;
  clienteId: string;
  atencion: string;
  celular: string;
  proyecto: string;
  ubicacion: string;
  fecha: string;
  validezDias: number;
  moneda: MonedaCot;
  secciones: SeccionCot[];
  tiempoEntrega: string;
  hitos: HitoCot[];
  notas: string;
  /** Detracción que aplica (la confirma el contador: 12 % servicios, 4 % construcción). */
  detraccion: number;
  estado: EstadoCotizacion;
  expedienteId?: string;
  motivoRechazo?: string;
  /** Versión en la base (evita que dos personas se pisen los cambios). */
  version?: number;
}

export type EstadoHito = 'pendiente' | 'facturado' | 'cobrado';

/** Hito ya con monto, dentro del servicio (expediente). */
export interface HitoPago extends HitoCot {
  monto: number;
  estado: EstadoHito;
  factura?: string;
  /** Comprobante de venta registrado en Finanzas · Ventas (vínculo real). */
  comprobanteId?: string;
}
