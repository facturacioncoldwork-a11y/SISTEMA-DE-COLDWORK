import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { DrawerModule } from 'primeng/drawer';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import type { Moneda, OrdenConPagos, Pago, ProyectoCompra } from '../../models/logistica.model';
import {
  ESTADOS_CUOTA,
  estadoCuota,
  fechasDe,
  formaDePago,
  formatoMonto,
  ordinalPago,
  planDe,
  PLANTILLAS,
  resumenPagos,
  textoAlLlegar,
  textoVence,
  tocaPagarPorLlegada,
  type EstadoCuota,
  type Plantilla,
} from '../../models/pagos';
import { hoyISO, sumar } from '../../models/plazos';
import { usarConfirmacion } from '../../services/confirmar';
import { LogisticaStore, mensajeError } from '../../services/logistica-store.service';
import { OrdenesCompraService } from '../../services/ordenes-compra.service';
import { codigoEnTexto, datosProyecto, eleccionDe } from '../../models/proyecto-oc';
import { PagosService } from '../../services/pagos.service';

type Filtro = 'deuda' | 'todas' | 'pagadas';
type Vista = 'cuadros' | 'tabla';

interface Equipo {
  orden: OrdenConPagos;
  sku: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  recibida: number;
}

interface Grupo {
  clave: string;
  codigo: string | null;
  nombre: string;
  ordenes: OrdenConPagos[];
  /** Productos que se compran para el proyecto (de todas sus OC). */
  equipos: Equipo[];
  /** Compras que ya llegaron y toca pagar el saldo. */
  tocaPagar: number;
  debemos: Record<Moneda, number>;
  comprado: Record<Moneda, number>;
}

interface Cuota extends Pago {
  orden: OrdenConPagos;
  estado: EstadoCuota;
}

/**
 * Vista: PAGOS A PROVEEDORES (solo el CEO).
 * Lo comprado por proyecto, cuándo llega, el plan de pagos de cada orden (adelanto, saldo,
 * crédito) y cuánto se debe, con aviso de lo vencido y de lo que vence pronto.
 */
@Component({
  selector: 'app-pagos-proveedores',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    DialogModule,
    DrawerModule,
    SelectModule,
    TooltipModule,
  ],
  templateUrl: './pagos.html',
  styleUrls: ['./pagos.scss', './pagos-cuadros.scss'],
})
export class PagosProveedores implements OnInit {
  protected readonly api = inject(PagosService);
  private readonly store = inject(LogisticaStore);
  private readonly router = inject(Router);
  private readonly ocs = inject(OrdenesCompraService);
  private readonly confirmar = usarConfirmacion();

  protected readonly estados = ESTADOS_CUOTA;
  protected readonly plantillas = Object.entries(PLANTILLAS).map(([clave, p]) => ({
    clave: clave as Plantilla,
    ...p,
  }));
  protected readonly monto = formatoMonto;
  protected readonly textoVence = textoVence;
  protected readonly alLlegar = textoAlLlegar;
  protected readonly ordinal = ordinalPago;
  protected readonly forma = formaDePago;
  protected readonly hoy = hoyISO();

  protected readonly vista = signal<Vista>(
    (localStorage.getItem('cw.pagos.vista') as Vista | null) ?? 'cuadros',
  );
  protected readonly filtro = signal<Filtro>('deuda');
  protected readonly texto = signal('');

  // Detalle de una OC
  protected readonly abiertaId = signal<string | null>(null);
  protected readonly abierta = computed(
    () => this.api.ordenes().find((o) => o.id === this.abiertaId()) ?? null,
  );
  protected detalleVisible = false;

  // Armar plan
  protected readonly plantilla = signal<Plantilla>('adelanto');
  protected readonly pctAdelanto = signal(50);
  protected readonly diasCredito = signal(30);

  // Cuota nueva / edición
  protected readonly editando = signal<Pago | 'nueva' | null>(null);
  protected readonly fConcepto = signal('');
  protected readonly fMonto = signal<number | null>(null);
  protected readonly fVence = signal('');
  protected readonly fNotas = signal('');
  /** La cuota vence N días después de que llega el equipo (0 = al llegar). */
  protected readonly fAlLlegar = signal(false);
  protected readonly fDias = signal(0);

  // Asignar proyecto a una compra
  protected readonly asignando = signal<OrdenConPagos | null>(null);
  protected readonly proyectos = signal<(ProyectoCompra & { etiqueta: string })[]>([]);
  protected readonly fProyecto = signal<string | null>(null);
  protected readonly fManual = signal(false);
  protected readonly fCodigo = signal('');
  protected readonly fNombreProy = signal('');
  /** Código de proyecto que ya venía escrito en la OC (notas, cliente…). */
  protected readonly sugerido = signal<string | null>(null);

  // Proyectos abiertos en la vista de cuadros
  private readonly abiertos = signal<ReadonlySet<string>>(new Set());

  // Marcar pagado
  protected readonly pagando = signal<Cuota | Pago | null>(null);
  protected readonly fPagadoEn = signal(hoyISO());
  protected readonly fReferencia = signal('');

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  async ngOnInit() {
    await this.recargar();
  }

  protected async recargar() {
    try {
      await this.api.recargar();
    } catch (e) {
      this.store.error('No se pudieron cargar los pagos', e);
    }
  }

  protected readonly resumen = computed(() => resumenPagos(this.api.ordenes(), this.hoy));

  /** Llegó el equipo y toca pagar el saldo (cuotas que dependían de la llegada). */
  protected readonly porLlegada = computed<Cuota[]>(() =>
    this.api
      .ordenes()
      .flatMap((o) =>
        o.pagos
          .filter((p) => tocaPagarPorLlegada(o, p, this.hoy))
          .map((p) => ({ ...p, orden: o, estado: estadoCuota(p, this.hoy) })),
      )
      .sort((a, b) => a.vence.localeCompare(b.vence)),
  );

  /** Todas las cuotas pendientes, la más urgente primero. */
  protected readonly proximas = computed<Cuota[]>(() =>
    this.api
      .ordenes()
      .flatMap((o) => o.pagos.map((p) => ({ ...p, orden: o, estado: estadoCuota(p, this.hoy) })))
      .filter((c) => c.estado !== 'pagado')
      .sort((a, b) => a.vence.localeCompare(b.vence))
      .slice(0, 8),
  );

  protected readonly grupos = computed<Grupo[]>(() => {
    const t = this.texto().trim().toLowerCase();
    const f = this.filtro();
    const mapa = new Map<string, Grupo>();
    for (const o of this.api.ordenes()) {
      const deuda = o.pendiente > 0 || o.sinPlan > 0;
      if (f === 'deuda' && !deuda) continue;
      if (f === 'pagadas' && deuda) continue;
      const texto =
        `${o.codigo} ${o.proveedor.razonSocial} ${o.proyecto?.nombre ?? ''} ${o.proyecto?.codigo ?? ''} ${o.items
          .map((i) => i.nombre)
          .join(' ')}`.toLowerCase();
      if (t && !texto.includes(t)) continue;
      const clave = o.proyecto?.codigo ?? '—';
      const g =
        mapa.get(clave) ??
        ({
          clave,
          codigo: o.proyecto?.codigo ?? null,
          nombre: o.proyecto?.nombre ?? 'Sin proyecto',
          ordenes: [],
          equipos: [],
          tocaPagar: 0,
          debemos: { PEN: 0, USD: 0 },
          comprado: { PEN: 0, USD: 0 },
        } satisfies Grupo);
      g.ordenes.push(o);
      for (const i of o.items)
        g.equipos.push({
          orden: o,
          sku: i.sku,
          nombre: i.nombre,
          unidad: i.unidad,
          cantidad: i.cantidad,
          recibida: Math.min(i.cantidadRecibida, i.cantidad),
        });
      if (this.tocaPagar(o)) g.tocaPagar++;
      g.debemos[o.moneda] += o.pendiente + o.sinPlan;
      g.comprado[o.moneda] += o.total;
      mapa.set(clave, g);
    }
    // Primero los proyectos con deuda; "Sin proyecto" al final
    return [...mapa.values()].sort(
      (a, b) =>
        Number(!a.codigo) - Number(!b.codigo) ||
        b.debemos.USD + b.debemos.PEN - (a.debemos.USD + a.debemos.PEN) ||
        a.nombre.localeCompare(b.nombre),
    );
  });

  // ─── Ayudas para la plantilla ─────────────────────────────────────
  /** En cuadros, cada proyecto se abre al tocarlo; en tabla o buscando, todos abiertos. */
  protected estaAbierto(g: Grupo) {
    return this.vista() === 'tabla' || !!this.texto().trim() || this.abiertos().has(g.clave);
  }
  protected alternar(g: Grupo) {
    const s = new Set(this.abiertos());
    if (s.has(g.clave)) s.delete(g.clave);
    else s.add(g.clave);
    this.abiertos.set(s);
  }
  protected cambiarVista(v: Vista) {
    this.vista.set(v);
    localStorage.setItem('cw.pagos.vista', v);
  }
  protected tocaPagar(o: OrdenConPagos) {
    return o.pagos.some((p) => tocaPagarPorLlegada(o, p, this.hoy));
  }
  /** Color del borde del cuadro: rojo vencido, naranja llegó y toca pagar, verde pagado. */
  protected colorCuadro(o: OrdenConPagos) {
    if (o.pendiente + o.sinPlan <= 0) return '#059669';
    if (o.pagos.some((p) => estadoCuota(p, this.hoy) === 'vencido')) return '#dc2626';
    if (this.tocaPagar(o)) return '#ea580c';
    if (!o.pagos.length) return '#d97706';
    return '#2563eb';
  }
  /** Nombre del equipo principal (el de más valor) y cuántos más trae la OC. */
  protected equipo(o: OrdenConPagos) {
    const [p, ...resto] = [...o.items].sort(
      (a, b) => b.cantidad * b.costoUnitario - a.cantidad * a.costoUnitario,
    );
    return {
      nombre: p ? p.nombre : 'Sin productos',
      cantidad: p ? `${p.cantidad} ${p.unidad}` : '',
      mas: resto.length,
      todos: this.productos(o),
    };
  }
  /** Texto de la cuota en el cuadro: pagado, "al llegar (~20 dic)", "vence en 3 días". */
  protected cuandoCuota(o: OrdenConPagos, p: Pago) {
    if (p.pagadoEn) return 'Pagado';
    const al = textoAlLlegar(p);
    if (al && !o.fechaLlegadaReal) return al.charAt(0).toUpperCase() + al.slice(1) + ' (aprox.)';
    if (tocaPagarPorLlegada(o, p, this.hoy)) return 'Llegó: toca pagar';
    return textoVence(p, this.hoy).replace(/^v/, 'V');
  }
  protected estadoDe(p: Pago) {
    return estadoCuota(p, this.hoy);
  }
  protected porcentajePagado(o: OrdenConPagos) {
    return o.total ? Math.min(100, Math.round((o.pagado / o.total) * 100)) : 0;
  }
  protected productos(o: OrdenConPagos) {
    return o.items.map((i) => `${i.cantidad} ${i.nombre}`).join(' · ');
  }
  protected llegada(o: OrdenConPagos) {
    if (o.fechaLlegadaReal) return { texto: 'Llegó', fecha: o.fechaLlegadaReal, ok: true };
    if (o.entregaHasta) return { texto: 'Llega aprox.', fecha: o.entregaHasta, ok: false };
    return { texto: 'Sin fecha', fecha: null, ok: false };
  }
  protected monedas(m: Record<Moneda, number>): string {
    const p: string[] = [];
    if (m.USD) p.push(formatoMonto(m.USD, 'USD'));
    if (m.PEN) p.push(formatoMonto(m.PEN, 'PEN'));
    return p.join(' + ') || formatoMonto(0, 'PEN');
  }
  protected vistaPrevia = computed(() => {
    const o = this.abierta();
    if (!o) return [];
    return planDe(o, {
      plantilla: this.plantilla(),
      adelanto: this.pctAdelanto(),
      dias: this.diasCredito(),
    });
  });
  protected fechas(o: OrdenConPagos) {
    return fechasDe(o);
  }

  // ─── Acciones ─────────────────────────────────────────────────────
  protected abrir(o: OrdenConPagos) {
    this.abiertaId.set(o.id);
    this.editando.set(null);
    this.diasCredito.set(o.proveedor.diasCredito || 30);
    this.plantilla.set(o.proveedor.diasCredito ? 'credito' : 'adelanto');
    this.detalleVisible = true;
  }

  protected verOc(o: OrdenConPagos) {
    void this.router.navigate(['/logistica/ordenes-compra'], { queryParams: { ver: o.id } });
  }

  /** Crea las cuotas de la plantilla. */
  protected async armarPlan() {
    const o = this.abierta();
    if (!o) return;
    await this.ejecutar(async () => {
      for (const c of this.vistaPrevia()) await this.api.crear({ ordenId: o.id, ...c });
      await this.api.recargar();
      this.store.ok('Plan de pagos guardado', `${o.codigo} · ${o.proveedor.razonSocial}`);
    });
  }

  protected nuevaCuota() {
    const o = this.abierta();
    this.editando.set('nueva');
    this.fConcepto.set('Pago');
    this.fMonto.set(o ? Math.max(0, Math.round(o.sinPlan * 100) / 100) || null : null);
    this.fVence.set(o ? fechasDe(o).llegada : hoyISO());
    this.fNotas.set('');
    this.fAlLlegar.set(false);
    this.fDias.set(0);
    this.error.set(null);
  }

  protected editar(p: Pago) {
    this.editando.set(p);
    this.fConcepto.set(p.concepto);
    this.fMonto.set(p.monto);
    this.fVence.set(p.vence);
    this.fNotas.set(p.notas ?? '');
    this.fAlLlegar.set(p.diasTrasLlegada !== null);
    this.fDias.set(p.diasTrasLlegada ?? 0);
    this.error.set(null);
  }

  protected async guardarCuota() {
    const o = this.abierta();
    const e = this.editando();
    if (!o || !e) return;
    const monto = Number(this.fMonto());
    if (!(monto > 0)) return this.error.set('Pon un monto mayor que cero.');
    const alLlegar = this.fAlLlegar();
    const dias = Math.round(Number(this.fDias()) || 0);
    if (alLlegar && (dias < 0 || dias > 365))
      return this.error.set('Los días después de la llegada van de 0 a 365.');
    if (!alLlegar && !/^\d{4}-\d{2}-\d{2}$/.test(this.fVence()))
      return this.error.set('Elige la fecha de vencimiento.');
    const datos = {
      concepto: this.fConcepto().trim() || 'Pago',
      monto: Math.round(monto * 100) / 100,
      // "Al llegar": vence con la llegada (real si ya llegó, si no la estimada) y se ajusta sola
      vence: alLlegar ? sumar(fechasDe(o).llegada, dias, 'dias') : this.fVence(),
      diasTrasLlegada: alLlegar ? dias : null,
      notas: this.fNotas().trim(),
    };
    await this.ejecutar(async () => {
      if (e === 'nueva') await this.api.crear({ ordenId: o.id, ...datos });
      else await this.api.actualizar(e.id, datos);
      await this.api.recargar();
      this.editando.set(null);
    });
  }

  protected async eliminarCuota(p: Pago) {
    if (
      !(await this.confirmar(
        '¿Quitar esta cuota?',
        `${p.concepto} · se borra del plan de pagos.`,
        'Sí, quitar',
      ))
    )
      return;
    await this.ejecutar(async () => {
      await this.api.eliminar(p.id);
      await this.api.recargar();
    });
  }

  protected async elegirProyecto(o: OrdenConPagos) {
    this.asignando.set(o);
    const ep = eleccionDe(o);
    this.fProyecto.set(ep.id);
    this.fManual.set(ep.manual);
    this.fCodigo.set(ep.codigo);
    this.fNombreProy.set(ep.nombre);
    this.sugerido.set(null);
    this.error.set(null);
    if (!this.proyectos().length) {
      const lista = await this.ocs.proyectos().catch(() => []);
      this.proyectos.set(
        lista.map((p) => ({
          ...p,
          etiqueta: `${p.codigo} · ${p.proyecto}${p.cliente ? ' · ' + p.cliente : ''}`,
        })),
      );
    }
    // Si la OC ya trae escrito el código de un proyecto, se deja elegido
    if (!o.proyecto) {
      const cod = codigoEnTexto(
        o,
        this.proyectos().map((p) => p.codigo),
      );
      const p = this.proyectos().find((x) => x.codigo === cod);
      if (p) {
        this.fProyecto.set(p.id);
        this.sugerido.set(p.codigo);
      }
    }
  }

  protected async guardarProyecto() {
    const o = this.asignando();
    if (!o) return;
    const datos = datosProyecto(
      {
        manual: this.fManual(),
        id: this.fProyecto(),
        codigo: this.fCodigo(),
        nombre: this.fNombreProy(),
      },
      true,
    );
    await this.ejecutar(async () => {
      await this.ocs.actualizar(o.id, datos);
      await this.api.recargar();
      const p = this.proyectos().find((x) => x.id === datos.proyectoId);
      const codigo = datos.proyectoCodigo ?? p?.codigo;
      this.store.ok(
        codigo ? 'Compra asignada al proyecto' : 'Compra sin proyecto',
        codigo ? `${o.codigo} → ${codigo}` : o.codigo,
      );
      this.asignando.set(null);
    });
  }

  protected abrirPago(p: Cuota | Pago) {
    this.pagando.set(p);
    this.fPagadoEn.set(hoyISO());
    this.fReferencia.set('');
    this.error.set(null);
  }

  protected async confirmarPago() {
    const p = this.pagando();
    if (!p) return;
    if (this.fPagadoEn() > hoyISO()) return this.error.set('La fecha de pago no puede ser futura.');
    await this.ejecutar(async () => {
      await this.api.pagar(p.id, this.fPagadoEn(), this.fReferencia().trim() || undefined);
      await this.api.recargar();
      this.store.ok('Pago registrado', `${p.concepto} · ${this.fPagadoEn()}`);
      this.pagando.set(null);
    });
  }

  protected async deshacer(p: Pago) {
    if (
      !(await this.confirmar(
        '¿Volver a pendiente?',
        `${p.concepto} se marcó como pagado. Vuelve a quedar pendiente.`,
        'Sí, deshacer',
      ))
    )
      return;
    await this.ejecutar(async () => {
      await this.api.deshacer(p.id);
      await this.api.recargar();
    });
  }

  private async ejecutar(fn: () => Promise<void>) {
    this.guardando.set(true);
    this.error.set(null);
    try {
      await fn();
    } catch (e) {
      const m = mensajeError(e) ?? 'No se pudo guardar';
      this.error.set(m);
      this.store.error('No se pudo guardar', e);
    } finally {
      this.guardando.set(false);
    }
  }

  /** Lista de pendientes en Excel (CSV), para compartir o imprimir. */
  protected exportar() {
    const filas = [
      [
        'Proyecto',
        'Código',
        'OC',
        'Proveedor',
        'Productos',
        'Aprobado',
        'Llegada',
        'Concepto',
        'Moneda',
        'Monto',
        'Vence',
        'Estado',
        'Pagado el',
        'Referencia',
      ],
      ...this.api
        .ordenes()
        .flatMap((o) =>
          (o.pagos.length ? o.pagos : [null]).map((p) => [
            o.proyecto?.nombre ?? 'Sin proyecto',
            o.proyecto?.codigo ?? '',
            o.codigo,
            o.proveedor.razonSocial,
            this.productos(o),
            o.fechaAprobado ?? '',
            o.fechaLlegadaReal ?? o.entregaHasta ?? '',
            p?.concepto ?? 'Sin plan de pagos',
            o.moneda,
            (p?.monto ?? o.sinPlan).toFixed(2),
            p?.vence ?? '',
            p ? ESTADOS_CUOTA[estadoCuota(p, this.hoy)].nombre : 'Sin plan',
            p?.pagadoEn ?? '',
            p?.referencia ?? '',
          ]),
        ),
    ];
    const csv =
      '﻿' +
      filas.map((f) => f.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), {
      href: url,
      download: `pagos-proveedores-${this.hoy}.csv`,
    }).click();
    URL.revokeObjectURL(url);
  }
}
