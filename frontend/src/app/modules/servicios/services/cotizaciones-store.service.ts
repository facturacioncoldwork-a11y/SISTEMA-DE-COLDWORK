import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { EmpresaActualService } from '../../../core/empresa/services/empresa-actual.service';
import { hoy } from '../../finanzas/utils/calculos';
import type { Cotizacion, LineaCot, SerieCotizacion } from '../models/cotizacion.model';
import { hitosConMonto, totalesCotizacion } from '../utils/cotizacion';
import { omitir } from '../utils/omitir';
import { DatosEmpresa } from './datos-empresa.service';
import { ExpedientesStore } from './expedientes-store.service';
import { OperacionesApi } from './operaciones-api.service';

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
 * Cotizaciones guardadas en la base de datos. El número (YG-PROY2026…) lo pone el servidor,
 * que también recalcula el total. Solo se edita en borrador; aprobada abre su servicio.
 * Las cuentas bancarias y el correo de órdenes se configurarán por empresa (nunca en el código).
 */
@Injectable({ providedIn: 'root' })
export class CotizacionesStore {
  private readonly expedientes = inject(ExpedientesStore);
  private readonly datos = inject(DatosEmpresa);
  private readonly api = inject(OperacionesApi);
  private readonly empresa = inject(EmpresaActualService);
  private cargadoPara: string | null = null;

  readonly cargando = signal(false);

  /** Datos de la empresa que salen en el PDF. */
  readonly datosPdf = computed(() => ({
    enviarOrdenA: this.datos.yo().correo,
    cuentas: [] as { banco: string; moneda: string; numero: string; cci: string }[],
  }));

  readonly cotizaciones = signal<Cotizacion[]>([]);

  constructor() {
    effect(() => {
      const e = this.empresa.id();
      if (e && e !== this.cargadoPara) {
        this.cargadoPara = e;
        void this.recargar();
      }
    });
  }

  async recargar() {
    this.cargando.set(true);
    try {
      this.cotizaciones.set(await this.api.cotizaciones());
    } catch {
      // Sin acceso a Ventas: la lista queda vacía
    } finally {
      this.cargando.set(false);
    }
  }

  cotizacion(id: string) {
    return this.cotizaciones().find((c) => c.id === id);
  }

  /** Crea el borrador en la base y devuelve la cotización ya con su número. */
  async nueva(serie: SerieCotizacion): Promise<Cotizacion> {
    const c: Cotizacion = {
      id: id(),
      serie,
      numero: '',
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
      version: 0,
    };
    const r = await this.api.guardarCotizacion(c.id, sinMeta(c), 0);
    const guardada = { ...c, numero: r.numero ?? '', version: r.version };
    this.cotizaciones.update((l) => [guardada, ...l]);
    return guardada;
  }

  /** Guarda la copia de trabajo del editor. Lanza el error para mostrarlo. */
  async guardar(c: Cotizacion) {
    const actual = this.cotizacion(c.id);
    const r = await this.api.guardarCotizacion(c.id, sinMeta(c), actual?.version ?? c.version ?? 0);
    this.cotizaciones.update((l) => l.map((x) => (x.id === c.id ? { ...structuredClone(c), estado: x.estado, numero: x.numero, version: r.version } : x)));
  }

  async cambiarEstado(id: string, estado: 'borrador' | 'enviada' | 'rechazada', motivoRechazo?: string) {
    await this.api.estadoCotizacion(id, estado, motivoRechazo);
    this.cotizaciones.update((l) =>
      l.map((x) =>
        x.id === id
          ? { ...x, estado, motivoRechazo: estado === 'rechazada' ? motivoRechazo : undefined, fecha: estado === 'enviada' ? hoy() : x.fecha, version: (x.version ?? 0) + 1 }
          : x,
      ),
    );
  }

  /**
   * El cliente aprobó: el servidor deja la cotización aprobada y abre (o actualiza) el servicio
   * con la orden del cliente y la forma de pago convertida en hitos con su monto, todo junto.
   */
  async aprobar(id: string, ordenCliente: string): Promise<string | null> {
    const c = this.cotizacion(id);
    if (!c) return null;
    const t = totalesCotizacion(c);
    const expediente = {
      cotizacion: { numero: c.numero, monto: t.valorVenta, fecha: c.fecha },
      ordenCliente: { numero: ordenCliente, fecha: hoy() },
      moneda: c.moneda,
      hitos: hitosConMonto(c.hitos, t.total),
      exigirAdelanto: c.hitos.length > 0,
    };
    const r = await this.api.aprobarCotizacion(id, ordenCliente, c.expedienteId ?? crypto.randomUUID(), expediente);
    this.cotizaciones.update((l) => l.map((x) => (x.id === id ? { ...x, estado: 'aprobada', expedienteId: r.expedienteId } : x)));
    await this.expedientes.traer(r.expedienteId);
    return r.expedienteId;
  }
}

/** Lo que va a la base: sin los campos que pone el servidor. */
function sinMeta(c: Cotizacion) {
  return omitir(c, 'numero', 'estado', 'version', 'expedienteId', 'motivoRechazo');
}
