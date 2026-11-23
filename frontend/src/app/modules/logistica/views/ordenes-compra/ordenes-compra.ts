import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DrawerModule } from 'primeng/drawer';
import { LineaTiempo } from '../../components/linea-tiempo/linea-tiempo';
import { ImportarCotizacion } from '../../components/importar-cotizacion/importar-cotizacion';
import { OrdenDialogo } from '../../components/orden-dialogo/orden-dialogo';
import { PdfOrden } from '../../components/pdf-orden/pdf-orden';
import {
  ESTADOS_OC,
  SIMBOLO,
  type EstadoOc,
  type OrdenCompra,
  type Producto,
} from '../../models/logistica.model';
import { colorCliente, colorLlegada, hoyISO, seguimiento } from '../../models/plazos';
import { usarConfirmacion } from '../../services/confirmar';
import { LogisticaStore } from '../../services/logistica-store.service';
import { OrdenesCompraService } from '../../services/ordenes-compra.service';

/**
 * Vista: ÓRDENES DE COMPRA.
 *  · Tablero por estado (borrador → enviada → parcial → recibida).
 *  · Línea de tiempo: cuándo llega cada pedido y si llegamos con el cliente.
 *  · CRUD completo: crear, ver, editar, eliminar (de la BD), enviar, anular.
 */
@Component({
  selector: 'app-ordenes-compra',
  imports: [
    FormsModule,
    DatePipe,
    DecimalPipe,
    DrawerModule,
    OrdenDialogo,
    LineaTiempo,
    ImportarCotizacion,
    PdfOrden,
  ],
  templateUrl: './ordenes-compra.html',
  styleUrl: './ordenes-compra.scss',
})
export class OrdenesCompra implements OnInit {
  private readonly api = inject(OrdenesCompraService);
  private readonly store = inject(LogisticaStore);
  private readonly confirmar = usarConfirmacion();
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly estados = ESTADOS_OC;
  protected readonly columnas: EstadoOc[] = ['borrador', 'enviada', 'parcial', 'recibida'];
  protected readonly ordenes = signal<OrdenCompra[]>([]);
  protected readonly cargando = signal(true);
  protected readonly texto = signal('');
  protected readonly vista = signal<'tablero' | 'tiempo'>('tablero');
  protected readonly verAnuladas = signal(false);
  protected readonly detalle = signal<OrdenCompra | null>(null);
  protected readonly detalleVisible = signal(false);
  protected readonly dialogo = signal(false);
  protected readonly editando = signal<OrdenCompra | null>(null);
  protected readonly sugeridos = signal<Producto[]>([]);
  protected readonly trabajando = signal(false);
  protected readonly fechaEntrega = signal(hoyISO());
  protected readonly importar = signal(false);
  protected readonly pdfVisible = signal(false);
  protected readonly simbolo = SIMBOLO;

  protected readonly seg = seguimiento;
  protected readonly colorLlegada = colorLlegada;
  protected readonly colorCliente = colorCliente;

  private readonly filtradas = computed(() => {
    const t = this.texto().trim().toLowerCase();
    return this.ordenes().filter(
      (o) =>
        !t ||
        [
          o.codigo,
          o.proveedor.razonSocial,
          o.almacen.nombre,
          o.cliente,
          ...o.items.map((i) => i.nombre),
        ]
          .join(' ')
          .toLowerCase()
          .includes(t),
    );
  });
  protected readonly porEstado = computed(() => {
    const m = new Map<EstadoOc, OrdenCompra[]>();
    for (const o of this.filtradas()) m.set(o.estado, [...(m.get(o.estado) ?? []), o]);
    return m;
  });
  protected readonly enTiempo = computed(() =>
    this.filtradas().filter((o) => o.estado !== 'borrador' || o.entregaHasta),
  );
  protected readonly visibles = computed(() =>
    this.verAnuladas() ? [...this.columnas, 'anulada' as EstadoOc] : this.columnas,
  );
  protected readonly alertas = computed(() => {
    let atrasadas = 0;
    let riesgo = 0;
    let semana = 0;
    for (const o of this.ordenes()) {
      if (o.estado === 'anulada') continue;
      const s = seguimiento(o);
      if (s.llegada === 'atrasada') atrasadas++;
      if (s.llegada === 'esta_semana' || s.llegada === 'en_ventana') semana++;
      if (s.cliente === 'riesgo' || s.cliente === 'vencido') riesgo++;
    }
    return { atrasadas, riesgo, semana };
  });
  /** Lo que falta llegar, por moneda (no se suman soles con dólares). */
  protected readonly enCamino = computed(() => {
    const t = { PEN: 0, USD: 0 };
    for (const o of this.ordenes()) {
      if (o.estado === 'enviada' || o.estado === 'parcial')
        t[o.moneda] += o.total * (1 - o.avance / 100);
    }
    return t;
  });

  async ngOnInit() {
    await Promise.all([this.cargar(), this.store.asegurar()]);
    const q = this.ruta.snapshot.queryParamMap;
    const prod = q.get('producto');
    if (prod) {
      const p = this.store.productoPorId().get(prod);
      this.nueva(p ? [p] : []);
    } else if (q.get('nuevo')) this.nueva();
    else if (q.get('importar')) this.importar.set(true);
    else if (q.get('ver')) {
      const o = this.ordenes().find((x) => x.id === q.get('ver'));
      if (o) this.ver(o);
    }
  }

  async cargar() {
    this.cargando.set(true);
    try {
      this.ordenes.set(await this.api.listar());
    } catch (e) {
      this.store.error('No se pudieron cargar las órdenes', e);
    } finally {
      this.cargando.set(false);
    }
  }

  protected nueva(sugeridos: Producto[] = []) {
    this.editando.set(null);
    this.sugeridos.set(sugeridos);
    this.dialogo.set(true);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected editar(o: OrdenCompra) {
    this.detalleVisible.set(false);
    this.editando.set(o);
    this.dialogo.set(true);
  }

  protected ver(o: OrdenCompra) {
    this.detalle.set(o);
    this.fechaEntrega.set(hoyISO());
    this.detalleVisible.set(true);
  }

  protected alGuardar(o: OrdenCompra) {
    this.reemplazar(o);
    this.ver(o);
  }

  protected async enviar(o: OrdenCompra) {
    await this.cambiar(() => this.api.enviar(o.id), 'Orden enviada al proveedor');
  }

  protected async anular(o: OrdenCompra) {
    if (
      await this.confirmar(
        `¿Anular ${o.codigo}?`,
        'Queda registrada como anulada y ya no podrá recibir productos.',
        'Sí, anular',
      )
    ) {
      await this.cambiar(() => this.api.anular(o.id), 'Orden anulada');
    }
  }

  /** DELETE real en la BD. */
  protected async eliminar(o: OrdenCompra) {
    const ok = await this.confirmar(
      `¿Eliminar ${o.codigo}?`,
      `Se borra de la base de datos junto con sus ${o.items.length} productos. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    this.trabajando.set(true);
    try {
      await this.api.eliminar(o.id);
      this.ordenes.update((l) => l.filter((x) => x.id !== o.id));
      this.detalleVisible.set(false);
      this.store.ok('Orden eliminada', o.codigo);
    } catch (e) {
      this.store.error('No se pudo eliminar', e);
    } finally {
      this.trabajando.set(false);
    }
  }

  protected async entregarCliente(o: OrdenCompra, fecha: string | null) {
    await this.cambiar(
      () => this.api.actualizar(o.id, { entregadoCliente: fecha }),
      fecha ? `Entregado a ${o.cliente ?? 'el cliente'}` : 'Entrega al cliente deshecha',
    );
  }

  protected recibir(o: OrdenCompra) {
    void this.router.navigate(['/logistica/llegadas'], { queryParams: { oc: o.id } });
  }

  /** Copia los productos de una orden en una nueva (pedidos que se repiten). */
  protected repetir(o: OrdenCompra) {
    const porId = this.store.productoPorId();
    this.detalleVisible.set(false);
    this.nueva(o.items.map((i) => porId.get(i.productoId)).filter((p): p is Producto => !!p));
  }

  private reemplazar(r: OrdenCompra) {
    this.ordenes.update((l) =>
      l.some((x) => x.id === r.id) ? l.map((x) => (x.id === r.id ? r : x)) : [r, ...l],
    );
    if (this.detalle()?.id === r.id) this.detalle.set(r);
  }

  private async cambiar(accion: () => Promise<OrdenCompra>, msg: string) {
    this.trabajando.set(true);
    try {
      const r = await accion();
      this.reemplazar(r);
      this.store.ok(msg, `${r.codigo} · ${r.proveedor.razonSocial}`);
    } catch (e) {
      this.store.error('No se pudo actualizar la orden', e);
    } finally {
      this.trabajando.set(false);
    }
  }
}
