import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { ESTADOS_OC, SIMBOLO, type EstadoOc, type OrdenCompra } from '../../models/logistica.model';
import { colorLlegada, seguimiento } from '../../models/plazos';
import { EstadoPago } from '../estado-pago/estado-pago';

interface Equipo {
  orden: OrdenCompra;
  sku: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  recibida: number;
}

interface Proyecto {
  clave: string;
  codigo: string | null;
  nombre: string;
  ordenes: OrdenCompra[];
  equipos: Equipo[];
  pedidos: number;
  recibidos: number;
  atrasadas: number;
  /** Próxima llegada pendiente (yyyy-mm-dd). */
  proxima: string | null;
  comprado: { PEN: number; USD: number };
}

/**
 * Órdenes de compra agrupadas por proyecto: un cuadro por proyecto (nombre y código) y,
 * al tocarlo, los equipos que se están comprando para él, con proveedor, OC y llegada.
 */
@Component({
  selector: 'app-proyectos-oc',
  imports: [DatePipe, DecimalPipe, EstadoPago],
  templateUrl: './proyectos-oc.html',
  styleUrl: './proyectos-oc.scss',
})
export class ProyectosOc {
  readonly ordenes = input.required<OrdenCompra[]>();
  readonly abrir = output<OrdenCompra>();

  protected readonly estados = ESTADOS_OC;
  protected readonly simbolo = SIMBOLO;
  protected readonly colorLlegada = colorLlegada;
  protected readonly seg = seguimiento;

  protected readonly elegido = signal<string | null>(null);

  protected readonly proyectos = computed<Proyecto[]>(() => {
    const mapa = new Map<string, Proyecto>();
    for (const o of this.ordenes()) {
      if (o.estado === 'anulada') continue;
      const clave = o.proyecto?.codigo ?? '—';
      const p =
        mapa.get(clave) ??
        ({
          clave,
          codigo: o.proyecto?.codigo ?? null,
          nombre: o.proyecto?.nombre ?? 'Sin proyecto',
          ordenes: [],
          equipos: [],
          pedidos: 0,
          recibidos: 0,
          atrasadas: 0,
          proxima: null,
          comprado: { PEN: 0, USD: 0 },
        } satisfies Proyecto);
      p.ordenes.push(o);
      p.comprado[o.moneda] += o.total;
      if (seguimiento(o).llegada === 'atrasada') p.atrasadas++;
      const pendiente = o.items.some((i) => i.cantidadRecibida < i.cantidad);
      if (pendiente && o.entregaHasta && (!p.proxima || o.entregaHasta < p.proxima)) {
        p.proxima = o.entregaHasta;
      }
      for (const i of o.items) {
        p.equipos.push({
          orden: o,
          sku: i.sku,
          nombre: i.nombre,
          unidad: i.unidad,
          cantidad: i.cantidad,
          recibida: Math.min(i.cantidadRecibida, i.cantidad),
        });
        p.pedidos += i.cantidad;
        p.recibidos += Math.min(i.cantidadRecibida, i.cantidad);
      }
      mapa.set(clave, p);
    }
    // Con proyecto primero (el más reciente arriba); "Sin proyecto" al final
    return [...mapa.values()].sort(
      (a, b) =>
        Number(!a.codigo) - Number(!b.codigo) || (b.codigo ?? '').localeCompare(a.codigo ?? ''),
    );
  });

  protected readonly abierto = computed(
    () => this.proyectos().find((p) => p.clave === this.elegido()) ?? null,
  );

  protected avance(p: Proyecto) {
    return p.pedidos ? Math.round((p.recibidos / p.pedidos) * 100) : 0;
  }

  protected elegir(p: Proyecto) {
    this.elegido.set(this.elegido() === p.clave ? null : p.clave);
  }

  protected montos(m: { PEN: number; USD: number }) {
    const t: string[] = [];
    if (m.USD) t.push(`US$ ${m.USD.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`);
    if (m.PEN) t.push(`S/ ${m.PEN.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`);
    return t.join(' + ') || '—';
  }

  protected estado(e: EstadoOc) {
    return this.estados[e];
  }
}
