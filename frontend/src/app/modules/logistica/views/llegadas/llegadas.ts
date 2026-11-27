import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { aISO, deISO } from '../../models/plazos';
import { usarConfirmacion } from '../../services/confirmar';
import { LlegadaAsistente } from '../../components/llegada-asistente/llegada-asistente';
import type { Llegada, OrdenCompra } from '../../models/logistica.model';
import { LogisticaStore } from '../../services/logistica-store.service';
import { MovimientosService } from '../../services/movimientos.service';
import { OrdenesCompraService } from '../../services/ordenes-compra.service';
import { DineroPipe } from '../../pipes/dinero.pipe';

/** Vista: LLEGADA DE PRODUCTO (historial + asistente de registro). */
@Component({
  selector: 'app-llegadas',
  imports: [
    DineroPipe,
    FormsModule,
    DatePipe,
    DecimalPipe,
    DialogModule,
    InputTextModule,
    LlegadaAsistente,
  ],
  templateUrl: './llegadas.html',
  styleUrl: '../salidas/documentos.scss',
})
export class Llegadas implements OnInit {
  private readonly api = inject(MovimientosService);
  private readonly ocApi = inject(OrdenesCompraService);
  private readonly store = inject(LogisticaStore);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly llegadas = signal<Llegada[]>([]);
  protected readonly pendientes = signal<OrdenCompra[]>([]);
  protected readonly cargando = signal(true);
  protected readonly texto = signal('');
  protected readonly abierta = signal<string | null>(null);
  protected readonly asistente = signal(false);
  protected readonly ordenInicial = signal<string | null>(null);
  private readonly confirmar = usarConfirmacion();

  // Editar datos del documento
  protected readonly editando = signal<Llegada | null>(null);
  protected readonly edGuia = signal('');
  protected readonly edComprobante = signal('');
  protected readonly edNotas = signal('');
  protected readonly edFecha = signal('');
  protected readonly guardando = signal(false);

  protected readonly lista = computed(() => {
    const t = this.texto().trim().toLowerCase();
    return this.llegadas().filter(
      (l) =>
        !t ||
        [
          l.codigo,
          l.proveedor?.razonSocial,
          l.guiaRemision,
          l.comprobante,
          l.orden?.codigo,
          ...l.lineas.map((x) => x.nombre),
        ]
          .join(' ')
          .toLowerCase()
          .includes(t),
    );
  });
  protected readonly delMes = computed(() => {
    const mes = new Date().toISOString().slice(0, 7);
    const l = this.llegadas().filter((x) => x.fecha.startsWith(mes));
    return { n: l.length, valor: l.reduce((t, x) => t + x.total, 0) };
  });

  async ngOnInit() {
    await Promise.all([this.cargar(), this.store.asegurar()]);
    const q = this.ruta.snapshot.queryParamMap;
    if (q.get('oc')) this.abrir(q.get('oc'));
    else if (q.get('nuevo')) this.abrir();
  }

  async cargar() {
    this.cargando.set(true);
    try {
      const [l, oc] = await Promise.all([this.api.llegadas(), this.ocApi.listar()]);
      this.llegadas.set(l);
      this.pendientes.set(oc.filter((o) => o.estado === 'enviada' || o.estado === 'parcial'));
    } catch (e) {
      this.store.error('No se pudieron cargar las llegadas', e);
    } finally {
      this.cargando.set(false);
    }
  }

  protected abrir(ordenId: string | null = null) {
    this.ordenInicial.set(ordenId);
    this.asistente.set(true);
    // Limpia ?nuevo / ?oc para que al recargar no se vuelva a abrir
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected alRegistrar(l: Llegada) {
    this.abierta.set(l.id);
    void this.cargar();
  }

  protected editar(l: Llegada) {
    this.edGuia.set(l.guiaRemision ?? '');
    this.edComprobante.set(l.comprobante ?? '');
    this.edNotas.set(l.notas ?? '');
    this.edFecha.set(aISO(new Date(l.fecha)));
    this.editando.set(l);
  }

  protected async guardarEdicion() {
    const l = this.editando();
    if (!l) return;
    this.guardando.set(true);
    try {
      const cambioFecha = this.edFecha() !== aISO(new Date(l.fecha));
      const r = await this.api.actualizarLlegada(l.id, {
        guiaRemision: this.edGuia(),
        comprobante: this.edComprobante(),
        notas: this.edNotas(),
        ...(cambioFecha
          ? { fecha: new Date(deISO(this.edFecha()).setHours(12)).toISOString() }
          : {}),
      });
      this.llegadas.update((x) => x.map((y) => (y.id === r.id ? r : y)));
      this.editando.set(null);
      this.store.ok('Llegada actualizada', r.codigo);
    } catch (e) {
      this.store.error('No se pudo guardar', e);
    } finally {
      this.guardando.set(false);
    }
  }

  /** DELETE real: la BD resta el stock que entró, borra su kardex y devuelve el avance de la OC. */
  protected async eliminar(l: Llegada) {
    const ok = await this.confirmar(
      `¿Eliminar ${l.codigo}?`,
      `Se borra de la base de datos y se RESTA del stock lo que entró (${l.lineas.length} productos)` +
        (l.orden ? `; ${l.orden.codigo} vuelve a quedar pendiente.` : '.') +
        ' Si parte de ese stock ya salió, no se podrá eliminar.',
    );
    if (!ok) return;
    try {
      await this.api.eliminarLlegada(l.id);
      this.store.ok('Llegada eliminada', `${l.codigo}: stock revertido`);
      await Promise.all([this.cargar(), this.store.recargar()]);
    } catch (e) {
      this.store.error('No se pudo eliminar', e);
    }
  }

  protected alternar(id: string) {
    this.abierta.update((a) => (a === id ? null : id));
  }
}
