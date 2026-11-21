import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GraficoDona, type Porcion } from '../../components/grafico-dona/grafico-dona';
import { GraficoFlujo } from '../../components/grafico-flujo/grafico-flujo';
import { MedidorStock } from '../../components/medidor-stock/medidor-stock';
import {
  nivelStock,
  TIPOS_ALMACEN,
  TIPOS_PRODUCTO,
  type Llegada,
  type ResumenLogistica,
  type Salida,
} from '../../models/logistica.model';
import { LogisticaStore } from '../../services/logistica-store.service';
import { MovimientosService } from '../../services/movimientos.service';
import { ProductosService } from '../../services/productos.service';
import { OrdenesCompraService } from '../../services/ordenes-compra.service';
import { colorCliente, colorLlegada, seguimiento } from '../../models/plazos';
import type { OrdenCompra } from '../../models/logistica.model';

interface Actividad {
  id: string;
  tipo: 'entrada' | 'salida';
  codigo: string;
  titulo: string;
  detalle: string;
  fecha: string;
  total: number;
}

/** Vista: panel de almacén (indicadores, flujo, reposición y actividad). */
@Component({
  selector: 'app-panel-logistica',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    RouterLink,
    GraficoFlujo,
    GraficoDona,
    MedidorStock,
  ],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel implements OnInit {
  private readonly productosApi = inject(ProductosService);
  private readonly movimientosApi = inject(MovimientosService);
  private readonly ocApi = inject(OrdenesCompraService);
  private readonly router = inject(Router);
  protected readonly store = inject(LogisticaStore);

  protected readonly resumen = signal<ResumenLogistica | null>(null);
  protected readonly llegadas = signal<Llegada[]>([]);
  protected readonly salidas = signal<Salida[]>([]);
  protected readonly ordenes = signal<OrdenCompra[]>([]);
  protected readonly colorLlegada = colorLlegada;
  protected readonly colorCliente = colorCliente;

  /** Valor que falta llegar, por moneda (no se mezclan soles con dólares). */
  protected readonly enCamino = computed(() => {
    const t = { PEN: 0, USD: 0 };
    for (const o of this.ordenes())
      if (o.estado === 'enviada' || o.estado === 'parcial')
        t[o.moneda] += o.subtotal * (1 - o.avance / 100);
    return t;
  });

  /** Lo que está en camino, lo más próximo (o atrasado) primero. */
  protected readonly proximas = computed(() =>
    this.ordenes()
      .filter((o) => o.estado === 'enviada' || o.estado === 'parcial')
      .map((o) => ({ o, s: seguimiento(o) }))
      .sort((a, b) => (a.o.entregaHasta ?? '9999').localeCompare(b.o.entregaHasta ?? '9999'))
      .slice(0, 6),
  );
  protected readonly cargando = signal(true);
  protected readonly tiposAlmacen = TIPOS_ALMACEN;

  /** Los más urgentes primero: agotados, luego por % del mínimo. */
  protected readonly reponer = computed(() =>
    this.store
      .productosActivos()
      .filter(
        (p) =>
          p.stockMinimo > 0 &&
          ['agotado', 'critico', 'bajo'].includes(nivelStock(p.stockTotal, p.stockMinimo)),
      )
      .sort((a, b) => a.stockTotal / a.stockMinimo - b.stockTotal / b.stockMinimo)
      .slice(0, 6),
  );

  protected readonly porciones = computed<Porcion[]>(() =>
    (this.resumen()?.porTipo ?? []).map((t) => ({
      etiqueta: TIPOS_PRODUCTO[t.tipo].nombre,
      valor: t.valor,
      color: TIPOS_PRODUCTO[t.tipo].color,
    })),
  );

  protected readonly actividad = computed<Actividad[]>(() =>
    [
      ...this.llegadas().map((l) => ({
        id: l.id,
        tipo: 'entrada' as const,
        codigo: l.codigo,
        titulo: l.proveedor?.razonSocial ?? 'Ingreso directo',
        detalle: `${l.lineas.length} productos → ${l.almacen.nombre}`,
        fecha: l.fecha,
        total: l.total,
      })),
      ...this.salidas().map((s) => ({
        id: s.id,
        tipo: 'salida' as const,
        codigo: s.codigo,
        titulo: s.destino || s.almacenDestino?.nombre || s.responsable || 'Salida',
        detalle: `${s.lineas.length} productos ← ${s.almacen.nombre}`,
        fecha: s.fecha,
        total: s.total,
      })),
    ]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 7),
  );

  protected readonly totalAlmacenes = computed(
    () => this.store.almacenesActivos().reduce((t, a) => t + a.valorizado, 0) || 1,
  );

  async ngOnInit() {
    try {
      const [r, l, s, o] = await Promise.all([
        this.productosApi.resumen(),
        this.movimientosApi.llegadas(),
        this.movimientosApi.salidas(),
        this.ocApi.listar(),
      ]);
      this.ordenes.set(o);
      this.resumen.set(r);
      this.llegadas.set(l);
      this.salidas.set(s);
    } catch (e) {
      this.store.error('No se pudo cargar el panel', e);
    } finally {
      this.cargando.set(false);
    }
  }

  protected verOc(id: string) {
    void this.router.navigate(['/logistica/ordenes-compra'], { queryParams: { ver: id } });
  }

  protected pedir(productoId: string) {
    void this.router.navigate(['/logistica/ordenes-compra'], {
      queryParams: { producto: productoId },
    });
  }
}
