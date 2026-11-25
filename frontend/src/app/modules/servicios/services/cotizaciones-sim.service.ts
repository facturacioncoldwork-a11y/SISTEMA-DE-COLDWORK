import { computed, inject, Injectable, signal } from '@angular/core';
import { hoy } from '../../finanzas/utils/calculos';
import type { Cotizacion, LineaCot, SerieCotizacion } from '../models/cotizacion.model';
import { hitosConMonto, numeroCotizacion, totalesCotizacion } from '../utils/cotizacion';
import { DatosEmpresa } from './datos-empresa.service';
import { ExpedientesSim } from './expedientes-sim.service';

const id = () => crypto.randomUUID();
const linea = (descripcion: string, unidad: string, cantidad: number, precio: number): LineaCot => ({
  id: id(),
  descripcion,
  unidad,
  cantidad,
  precio,
  costo: null,
});

/**
 * VISTA PREVIA de cotizaciones: en memoria, aún no se guardan. Empiezan vacías.
 * Las cuentas bancarias y el correo de órdenes se configurarán por empresa (nunca en el código).
 */
@Injectable({ providedIn: 'root' })
export class CotizacionesSim {
  private readonly expedientes = inject(ExpedientesSim);
  private readonly datos = inject(DatosEmpresa);

  /** Datos de la empresa que salen en el PDF. */
  readonly datosPdf = computed(() => ({
    enviarOrdenA: this.datos.yo().correo,
    cuentas: [] as { banco: string; moneda: string; numero: string; cci: string }[],
  }));

  /** Correlativo compartido por las series PROY y SERV. */
  private correlativo = 0;

  readonly cotizaciones = signal<Cotizacion[]>([]);

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
      const e = this.expedientes.crear({ clienteId: c.clienteId, titulo: c.proyecto, solicitud: `Cotización ${c.numero}`, responsableId: this.datos.yo().id });
      expedienteId = e.id;
      this.expedientes.actualizar(e.id, { ...datos, etapa: 'orden_cliente' }, `El cliente aprobó la cotización ${c.numero}: orden ${ordenCliente}.`);
    }
    this.cotizaciones.update((l) => l.map((x) => (x.id === id ? { ...x, estado: 'aprobada', expedienteId } : x)));
    return expedienteId ?? null;
  }
}
