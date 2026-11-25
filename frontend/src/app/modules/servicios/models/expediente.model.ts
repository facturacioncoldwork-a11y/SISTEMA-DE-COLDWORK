import type { HitoPago } from './cotizacion.model';

/**
 * Expediente de servicio: TODO lo de un trabajo para un cliente, de principio a fin
 * (solicitud → cotización → orden del cliente → ingreso a planta → ejecución →
 * conformidad → factura → cobranza). Reemplaza el seguimiento por WhatsApp.
 */

export type EtapaExpediente =
  | 'solicitud'
  | 'cotizacion'
  | 'orden_cliente'
  | 'ingreso'
  | 'ejecucion'
  | 'conformidad'
  | 'facturado'
  | 'cobrado';

export interface Persona {
  id: string;
  nombre: string;
  cargo: string;
}

export interface Tarea {
  id: string;
  texto: string;
  asignadoA: string;
  vence: string;
  hecha: boolean;
}

export type EstadoCompra = 'por_pedir' | 'pedido' | 'llego';

export interface Compra {
  id: string;
  descripcion: string;
  proveedor: string;
  estado: EstadoCompra;
}

export interface EventoHistorial {
  fecha: string;
  autor: string;
  texto: string;
}

export interface Expediente {
  id: string;
  codigo: string;
  clienteId: string;
  titulo: string;
  /** Lo que pidió el cliente (correo / WhatsApp). */
  solicitud: string;
  responsableId: string;
  etapa: EtapaExpediente;
  creado: string;
  cotizacion?: { numero: string; monto: number; fecha: string };
  ordenCliente?: { numero: string; fecha: string };
  ingreso: {
    personal: string[];
    fecha?: string;
    sctrEnviado: boolean;
    induccion: boolean;
    guiaRemision: boolean;
    correoEnviado: boolean;
  };
  ordenesTrabajo: string[];
  conformidad?: { fecha: string; hes?: string };
  factura?: { numero: string; fecha: string };
  tareas: Tarea[];
  compras: Compra[];
  historial: EventoHistorial[];
  /** Moneda de la cotización aprobada. */
  moneda?: 'USD' | 'PEN';
  /** Forma de pago de la cotización, con su monto: adelantos, valorizaciones y saldo. */
  hitos?: HitoPago[];
  /** No se programa el trabajo hasta cobrar el primer adelanto. */
  exigirAdelanto?: boolean;
}
