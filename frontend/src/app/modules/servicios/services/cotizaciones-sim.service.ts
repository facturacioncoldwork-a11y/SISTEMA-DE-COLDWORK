import { inject, Injectable, signal } from '@angular/core';
import { hoy, sumarDias } from '../../finanzas/utils/calculos';
import type { Cotizacion, LineaCot, SerieCotizacion } from '../models/cotizacion.model';
import { hitosConMonto, numeroCotizacion, totalesCotizacion } from '../utils/cotizacion';
import { ExpedientesSim } from './expedientes-sim.service';

/** Datos fijos que salen en el PDF (al conectarlo, se configuran por empresa, no en el código). */
export const DATOS_COTIZACION = {
  enviarOrdenA: 'ventas@empresa.pe',
  cuentas: [
    { banco: 'BBVA', moneda: 'USD', numero: '(se configura por empresa)', cci: '' },
    { banco: 'BBVA', moneda: 'SOLES', numero: '(se configura por empresa)', cci: '' },
    { banco: 'Banco de la Nación', moneda: 'DETRACCIÓN', numero: '(se configura por empresa)', cci: '' },
  ],
};

const id = () => crypto.randomUUID();
const linea = (descripcion: string, unidad: string, cantidad: number, precio: number, costo?: number): LineaCot => ({
  id: id(),
  descripcion,
  unidad,
  cantidad,
  precio,
  costo: costo ?? null,
});

/**
 * SIMULACIÓN de cotizaciones: solo en memoria. La primera replica la estructura del Excel
 * de ejemplo (packing de uva) para comparar.
 */
@Injectable({ providedIn: 'root' })
export class CotizacionesSim {
  private readonly expedientes = inject(ExpedientesSim);

  /** Correlativo compartido por las series PROY y SERV. */
  private correlativo = 99;

  readonly cotizaciones = signal<Cotizacion[]>(this.ejemplo());

  cotizacion(id: string) {
    return this.cotizaciones().find((c) => c.id === id);
  }

  nueva(serie: SerieCotizacion): Cotizacion {
    this.correlativo++;
    const c: Cotizacion = {
      id: id(),
      serie,
      numero: numeroCotizacion(serie, new Date().getFullYear(), this.correlativo),
      clienteId: '',
      atencion: '',
      celular: '',
      proyecto: '',
      ubicacion: '',
      fecha: hoy(),
      validezDias: serie === 'PROY' ? 15 : 7,
      moneda: serie === 'PROY' ? 'USD' : 'PEN',
      secciones: [{ id: id(), titulo: serie === 'PROY' ? 'Equipos de frío' : 'Servicio', lineas: [linea('', 'UND.', 1, 0)] }],
      tiempoEntrega: '',
      hitos:
        serie === 'PROY'
          ? [
              { id: id(), descripcion: '1.er adelanto con la orden', porcentaje: 40 },
              { id: id(), descripcion: '2.º adelanto según valorización', porcentaje: 50 },
              { id: id(), descripcion: 'Saldo con la entrega', porcentaje: 10 },
            ]
          : [
              { id: id(), descripcion: 'Adelanto con la orden', porcentaje: 50 },
              { id: id(), descripcion: 'Saldo con la conformidad', porcentaje: 50 },
            ],
      notas: 'No incluye obras civiles ni acometidas eléctricas.',
      detraccion: 12,
      estado: 'borrador',
    };
    this.cotizaciones.update((l) => [c, ...l]);
    return c;
  }

  guardar(c: Cotizacion) {
    this.cotizaciones.update((l) => l.map((x) => (x.id === c.id ? structuredClone(c) : x)));
  }

  cambiarEstado(id: string, estado: Cotizacion['estado'], motivoRechazo?: string) {
    this.cotizaciones.update((l) => l.map((x) => (x.id === id ? { ...x, estado, motivoRechazo } : x)));
  }

  /**
   * El cliente aprobó: se abre (o actualiza) el servicio con la orden del cliente
   * y la forma de pago convertida en hitos con su monto.
   */
  aprobar(id: string, ordenCliente: string): string | null {
    const c = this.cotizacion(id);
    if (!c) return null;
    const t = totalesCotizacion(c);
    const datos = {
      cotizacion: { numero: c.numero, monto: t.valorVenta, fecha: c.fecha },
      ordenCliente: { numero: ordenCliente, fecha: hoy() },
      moneda: c.moneda,
      hitos: hitosConMonto(c.hitos, t.total),
      exigirAdelanto: c.hitos.length > 0,
    };
    let expedienteId = c.expedienteId;
    if (expedienteId && this.expedientes.expediente(expedienteId)) {
      this.expedientes.actualizar(expedienteId, { ...datos, etapa: 'orden_cliente' }, `El cliente aprobó la cotización ${c.numero}: orden ${ordenCliente}.`);
    } else {
      const e = this.expedientes.crear({ clienteId: c.clienteId, titulo: c.proyecto, solicitud: `Cotización ${c.numero}`, responsableId: 'p1' });
      expedienteId = e.id;
      this.expedientes.actualizar(e.id, { ...datos, etapa: 'orden_cliente' }, `El cliente aprobó la cotización ${c.numero}: orden ${ordenCliente}.`);
    }
    this.cotizaciones.update((l) => l.map((x) => (x.id === id ? { ...x, estado: 'aprobada', expedienteId } : x)));
    return expedienteId ?? null;
  }

  private ejemplo(): Cotizacion[] {
    const h = hoy();
    return [
      {
        id: 'q1',
        serie: 'PROY',
        numero: 'YG-PROY202600098',
        clienteId: 'c1',
        atencion: 'Jefa de proyectos',
        celular: '',
        proyecto: 'Proyecto packing uva 2026',
        ubicacion: 'Pedregal - Arequipa',
        fecha: sumarDias(h, -4),
        validezDias: 15,
        moneda: 'USD',
        tiempoEntrega: '2 a 3 meses (equipos: 45 días de ensamblado)',
        detraccion: 4,
        estado: 'enviada',
        notas: 'No incluye acometidas eléctricas ni obras civiles.\nEquipos: 45 días de ensamblado.',
        hitos: [
          { id: id(), descripcion: '1.er adelanto con la orden', porcentaje: 40 },
          { id: id(), descripcion: '2.º adelanto según valorización', porcentaje: 50 },
          { id: id(), descripcion: 'Saldo con la entrega', porcentaje: 10 },
        ],
        secciones: [
          {
            id: id(),
            titulo: 'Cámara de productos terminados #1 (R507 · 440V/3F/60Hz)',
            lineas: [
              linea('Unidad condensadora de 12 HP', 'UND.', 2, 12250, 10412.5),
              linea('Evaporador cúbico Mipal o similar', 'UND.', 4, 4400, 3740),
              linea('Componentes del sistema', 'GLB.', 1, 5643.53, 4797),
              linea('Montaje electromecánico del sistema de refrigeración', 'GLB.', 1, 14171.18, 12045.5),
              linea('Puesta en marcha', 'GLB.', 1, 2530),
            ],
          },
          {
            id: id(),
            titulo: 'Pasillo (R507 · 440V/3F/60Hz)',
            lineas: [
              linea('Unidad condensadora de 10 HP', 'UND.', 1, 10250, 8712.5),
              linea('Evaporador cúbico Mipal o similar', 'UND.', 2, 4400, 3740),
              linea('Componentes del sistema', 'GLB.', 1, 3513.53, 2986.5),
              linea('Montaje electromecánico del sistema de refrigeración', 'GLB.', 1, 12551.18, 10668.5),
              linea('Puesta en marcha', 'GLB.', 1, 3430),
            ],
          },
          {
            id: id(),
            titulo: 'Paneles y puertas',
            lineas: [
              linea('Suministro de paneles POL, puestos en obra', 'GLB.', 1, 40990),
              linea('Suministro de puertas y accesorios', 'GLB.', 1, 21629.67),
              linea('Suministros locales', 'GLB.', 1, 8750),
              linea('Montaje de paneles', 'GLB.', 1, 12270.59, 10430),
            ],
          },
          {
            id: id(),
            titulo: 'Otros',
            lineas: [
              linea('Estructura para túneles', 'GLB.', 1, 1800),
              linea('Estructura para cámara', 'GLB.', 1, 15890),
              linea('Transporte de materiales', 'GLB.', 1, 1500),
            ],
          },
          {
            id: id(),
            titulo: 'Viáticos',
            lineas: [
              linea('Supervisión de proyecto', 'GLB.', 1, 500),
              linea('Traslado de personal, seguros y alimentación', 'GLB.', 1, 2500),
            ],
          },
        ],
      },
      {
        id: 'q2',
        serie: 'SERV',
        numero: 'YG-SERV202600099',
        clienteId: 'c2',
        atencion: 'Sr. Miguel Torres',
        celular: '',
        proyecto: 'Mantenimiento trimestral del chiller',
        ubicacion: 'Pisco - Ica',
        fecha: sumarDias(h, -1),
        validezDias: 7,
        moneda: 'PEN',
        tiempoEntrega: '1 día de trabajo',
        detraccion: 12,
        estado: 'enviada',
        expedienteId: 'ex2',
        notas: 'Incluye limpieza de condensadores y evaporadores.',
        hitos: [
          { id: id(), descripcion: 'Adelanto con la orden', porcentaje: 50 },
          { id: id(), descripcion: 'Saldo con la conformidad', porcentaje: 50 },
        ],
        secciones: [
          {
            id: id(),
            titulo: 'Mantenimiento preventivo · Chiller Carrier 30RB-060',
            lineas: [
              linea('Limpieza química de condensador y evaporador', 'SERV.', 1, 850, 520),
              linea('Revisión eléctrica y ajuste de borneras', 'SERV.', 1, 300, 150),
              linea('Medición de presiones, temperaturas y consumos', 'SERV.', 1, 250, 100),
              linea('Informe técnico con fotos', 'UND.', 1, 250, 60),
            ],
          },
        ],
      },
    ];
  }
}
