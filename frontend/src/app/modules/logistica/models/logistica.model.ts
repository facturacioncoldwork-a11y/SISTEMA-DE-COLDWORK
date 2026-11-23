/**
 * Interfaces del módulo Almacén y logística = DTOs del backend
 * (backend/src/modules/logistica/dto). Si cambias uno, cambia el otro.
 */

export type TipoProducto = 'repuesto' | 'gas_refrigerante' | 'herramienta' | 'insumo' | 'equipo';
export type TipoAlmacen = 'principal' | 'movil' | 'obra';
export type EstadoOc = 'borrador' | 'enviada' | 'parcial' | 'recibida' | 'anulada';
export type Moneda = 'PEN' | 'USD';
export type MotivoSalida =
  'servicio_tecnico' | 'venta' | 'consumo_interno' | 'merma' | 'transferencia';

export interface StockAlmacen {
  almacenId: string;
  cantidad: number;
}

export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoProducto;
  marca: string | null;
  unidad: string;
  stockMinimo: number;
  costoPromedio: number;
  stockTotal: number;
  valorizado: number;
  stock: StockAlmacen[];
  activo: boolean;
}

export interface GuardarProducto {
  sku: string;
  nombre: string;
  descripcion?: string;
  tipo: TipoProducto;
  marca?: string;
  unidad: string;
  stockMinimo: number;
  activo?: boolean;
}

export interface Movimiento {
  id: number;
  fecha: string;
  tipo: 'entrada' | 'salida';
  almacenId: string;
  cantidad: number;
  costoUnitario: number;
  saldo: number;
  documento: string;
  detalle: string;
}

export interface Almacen {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoAlmacen;
  direccion: string | null;
  responsable: string | null;
  activo: boolean;
  productos: number;
  valorizado: number;
}

export interface GuardarAlmacen {
  codigo: string;
  nombre: string;
  tipo: TipoAlmacen;
  direccion?: string;
  responsable?: string;
  activo?: boolean;
}

export interface Proveedor {
  id: string;
  tipoDocumento: 'RUC' | 'DNI' | 'CE' | 'OTRO';
  numeroDocumento: string;
  razonSocial: string;
  rubro: string | null;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  diasCredito: number;
  calificacion: number | null;
  activo: boolean;
}

export type GuardarProveedor = Partial<Omit<Proveedor, 'id'>> &
  Pick<Proveedor, 'tipoDocumento' | 'numeroDocumento' | 'razonSocial'>;

export interface ItemOrden {
  productoId: string;
  sku: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  cantidadRecibida: number;
  costoUnitario: number;
  subtotal: number;
}

export interface OrdenCompra {
  id: string;
  codigo: string;
  estado: EstadoOc;
  fecha: string;
  /** Lo que dijo el proveedor: "2-3 semanas", "1 mes", "Fecha exacta". */
  plazoTexto: string | null;
  /** Ventana estimada de llegada. Con fecha exacta, desde = hasta. */
  entregaDesde: string | null;
  entregaHasta: string | null;
  /** Se llena sola cuando llega todo. */
  fechaLlegadaReal: string | null;
  cliente: string | null;
  compromisoCliente: string | null;
  entregadoCliente: string | null;
  notas: string | null;
  moneda: Moneda;
  condicionesPago: string | null;
  lugarEntrega: string | null;
  atencion: string | null;
  solicitadoPor: string | null;
  /** N° de la cotización del proveedor de la que salió ("HC 1724"). */
  cotizacionRef: string | null;
  proveedor: { id: string; razonSocial: string; numeroDocumento: string; direccion: string | null };
  almacen: { id: string; nombre: string };
  items: ItemOrden[];
  subtotal: number;
  igv: number;
  total: number;
  avance: number;
}

export interface PlazoOrden {
  plazoTexto?: string;
  entregaDesde?: string | null;
  entregaHasta?: string | null;
  cliente?: string;
  compromisoCliente?: string | null;
  notas?: string;
  moneda?: Moneda;
  condicionesPago?: string;
  lugarEntrega?: string;
  atencion?: string;
  solicitadoPor?: string;
  cotizacionRef?: string;
}

export interface CrearOrdenCompra extends PlazoOrden {
  proveedorId: string;
  almacenId: string;
  enviar?: boolean;
  items: { productoId: string; cantidad: number; costoUnitario: number }[];
}

export interface ActualizarOrdenCompra extends PlazoOrden {
  proveedorId?: string;
  almacenId?: string;
  entregadoCliente?: string | null;
  items?: { productoId: string; cantidad: number; costoUnitario: number }[];
}

export interface LineaDocumento {
  productoId: string;
  sku: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  costoUnitario: number;
}

export interface Llegada {
  id: string;
  codigo: string;
  fecha: string;
  almacen: { id: string; nombre: string };
  proveedor: { id: string; razonSocial: string } | null;
  orden: { id: string; codigo: string } | null;
  moneda: Moneda;
  tipoCambio: number | null;
  guiaRemision: string | null;
  comprobante: string | null;
  notas: string | null;
  lineas: LineaDocumento[];
  total: number;
}

export interface CrearLlegada {
  almacenId: string;
  ordenId?: string;
  proveedorId?: string;
  guiaRemision?: string;
  comprobante?: string;
  notas?: string;
  /** Cuándo llegó de verdad (ISO). Por defecto, ahora. */
  fecha?: string;
  /** Moneda de la OC. Los costoUnitario van SIEMPRE en soles (ya convertidos). */
  moneda?: Moneda;
  tipoCambio?: number;
  items: { productoId: string; cantidad: number; costoUnitario: number }[];
}

export interface ActualizarLlegada {
  guiaRemision?: string;
  comprobante?: string;
  notas?: string;
  fecha?: string;
}

export interface ActualizarSalida {
  destino?: string;
  responsable?: string;
  referencia?: string;
  notas?: string;
}

export interface Salida {
  id: string;
  codigo: string;
  fecha: string;
  motivo: MotivoSalida;
  almacen: { id: string; nombre: string };
  almacenDestino: { id: string; nombre: string } | null;
  destino: string | null;
  responsable: string | null;
  referencia: string | null;
  notas: string | null;
  lineas: LineaDocumento[];
  total: number;
}

export interface CrearSalida {
  almacenId: string;
  motivo: MotivoSalida;
  almacenDestinoId?: string;
  destino?: string;
  responsable?: string;
  referencia?: string;
  notas?: string;
  items: { productoId: string; cantidad: number }[];
}

export interface ResumenLogistica {
  valorInventario: number;
  productosActivos: number;
  bajoMinimo: number;
  sinStock: number;
  ocPendientes: number;
  ocPorRecibirValor: number;
  llegadasMes: number;
  salidasMes: number;
  flujo: { dia: string; entradas: number; salidas: number }[];
  porTipo: { tipo: TipoProducto; valor: number }[];
}

// ---------- Catálogos para pantallas ----------

export const TIPOS_PRODUCTO: Record<
  TipoProducto,
  { nombre: string; icono: string; color: string }
> = {
  repuesto: { nombre: 'Repuesto', icono: 'pi pi-cog', color: '#0ea5e9' },
  gas_refrigerante: { nombre: 'Gas refrigerante', icono: 'pi pi-cloud', color: '#14b8a6' },
  herramienta: { nombre: 'Herramienta', icono: 'pi pi-wrench', color: '#f59e0b' },
  insumo: { nombre: 'Insumo', icono: 'pi pi-box', color: '#8b5cf6' },
  equipo: { nombre: 'Equipo', icono: 'pi pi-server', color: '#ec4899' },
};

export const TIPOS_ALMACEN: Record<TipoAlmacen, { nombre: string; icono: string; ayuda: string }> =
  {
    principal: {
      nombre: 'Principal',
      icono: 'pi pi-building',
      ayuda: 'Almacén físico de la empresa',
    },
    movil: {
      nombre: 'Unidad móvil',
      icono: 'pi pi-car',
      ayuda: 'Camioneta o maletín de un técnico',
    },
    obra: {
      nombre: 'Obra',
      icono: 'pi pi-map-marker',
      ayuda: 'Material dejado en un cliente o proyecto',
    },
  };

export const ESTADOS_OC: Record<EstadoOc, { nombre: string; color: string }> = {
  borrador: { nombre: 'Borrador', color: '#64748b' },
  enviada: { nombre: 'Enviada', color: '#0ea5e9' },
  parcial: { nombre: 'Llegada parcial', color: '#f59e0b' },
  recibida: { nombre: 'Recibida', color: '#10b981' },
  anulada: { nombre: 'Anulada', color: '#ef4444' },
};

export const MOTIVOS_SALIDA: Record<
  MotivoSalida,
  { nombre: string; icono: string; ayuda: string }
> = {
  servicio_tecnico: {
    nombre: 'Servicio técnico',
    icono: 'pi pi-wrench',
    ayuda: 'Material para una orden de servicio',
  },
  venta: { nombre: 'Venta', icono: 'pi pi-shopping-cart', ayuda: 'Despacho a un cliente' },
  consumo_interno: {
    nombre: 'Consumo interno',
    icono: 'pi pi-home',
    ayuda: 'Uso de la oficina o taller',
  },
  merma: { nombre: 'Merma / baja', icono: 'pi pi-trash', ayuda: 'Dañado, vencido o perdido' },
  transferencia: {
    nombre: 'Transferencia',
    icono: 'pi pi-arrow-right-arrow-left',
    ayuda: 'Pasa a otro almacén',
  },
};

export const UNIDADES = [
  'UND',
  'KG',
  'LB',
  'BAL',
  'M',
  'PIE',
  'LT',
  'GAL',
  'JGO',
  'KIT',
  'ROLLO',
  'CAJA',
];

/** Nivel de stock para el semáforo. */
export type NivelStock = 'agotado' | 'critico' | 'bajo' | 'ok';
export function nivelStock(cantidad: number, minimo: number): NivelStock {
  if (cantidad <= 0) return 'agotado';
  if (minimo <= 0) return 'ok';
  if (cantidad <= minimo) return 'critico';
  if (cantidad <= minimo * 1.5) return 'bajo';
  return 'ok';
}

export const SIMBOLO: Record<Moneda, string> = { PEN: 'S/', USD: 'US$' };
