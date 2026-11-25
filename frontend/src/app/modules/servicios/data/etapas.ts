import type { EstadoCompra, EtapaExpediente } from '../models/expediente.model';

/** Etapas del expediente en orden, con lo que se espera en cada una. */
export const ETAPAS: { clave: EtapaExpediente; nombre: string; icono: string; espera: string }[] = [
  { clave: 'solicitud', nombre: 'Solicitud', icono: 'pi pi-inbox', espera: 'Hacer la visita o diagnóstico y cotizar' },
  { clave: 'cotizacion', nombre: 'Cotización', icono: 'pi pi-file-edit', espera: 'Esperando que el cliente apruebe' },
  { clave: 'orden_cliente', nombre: 'Orden del cliente', icono: 'pi pi-verified', espera: 'Coordinar el ingreso a planta' },
  { clave: 'ingreso', nombre: 'Ingreso a planta', icono: 'pi pi-id-card', espera: 'Programar la orden de trabajo' },
  { clave: 'ejecucion', nombre: 'Ejecución', icono: 'pi pi-wrench', espera: 'Técnicos trabajando · informe técnico' },
  { clave: 'conformidad', nombre: 'Conformidad', icono: 'pi pi-check-square', espera: 'Emitir la factura' },
  { clave: 'facturado', nombre: 'Facturado', icono: 'pi pi-receipt', espera: 'Esperando el pago' },
  { clave: 'cobrado', nombre: 'Cobrado', icono: 'pi pi-wallet', espera: 'Servicio terminado' },
];

export function indiceEtapa(e: EtapaExpediente): number {
  return ETAPAS.findIndex((x) => x.clave === e);
}

export const ESTADOS_COMPRA: Record<EstadoCompra, { nombre: string; clase: string; siguiente: EstadoCompra | null }> = {
  por_pedir: { nombre: 'Por pedir', clase: 'agotado', siguiente: 'pedido' },
  pedido: { nombre: 'Pedido al proveedor', clase: 'bajo', siguiente: 'llego' },
  llego: { nombre: 'Llegó', clase: 'ok', siguiente: null },
};
