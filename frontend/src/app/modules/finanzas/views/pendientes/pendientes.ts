import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { MovimientoDialogo } from '../../components/movimiento-dialogo/movimiento-dialogo';
import { nombreTipoDoc, TRAMOS } from '../../data/finanzas';
import type { Operacion, Pendiente } from '../../models/finanzas.model';
import { FinanzasApi } from '../../services/finanzas-api.service';
import { FinanzasStore } from '../../services/finanzas-store.service';
import { dinero, redondear } from '../../utils/calculos';
import { descargarCsv } from '../../utils/csv';

type Tramo = Pendiente['tramo'];
const ORDEN_TRAMOS: Tramo[] = ['por_vencer', '1-30', '31-60', '61-90', 'mas_90'];

/** Cuentas por cobrar (ventas) o por pagar (compras) con antigüedad de saldos. */
@Component({
  selector: 'app-pendientes',
  imports: [FormsModule, NgTemplateOutlet, RouterLink, MovimientoDialogo],
  templateUrl: './pendientes.html',
  styleUrl: './pendientes.scss',
})
export class Pendientes {
  private readonly api = inject(FinanzasApi);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly store = inject(FinanzasStore);

  protected readonly operacion = toSignal(this.ruta.data.pipe(map((d) => d['operacion'] as Operacion)), {
    initialValue: 'venta' as Operacion,
  });
  protected readonly esCobro = computed(() => this.operacion() === 'venta');

  protected readonly lista = signal<Pendiente[]>([]);
  protected readonly cargando = signal(false);
  protected readonly texto = signal('');
  protected readonly tramo = signal<Tramo | null>(null);
  protected readonly agrupar = signal(false);

  protected readonly dialogo = signal(false);
  protected readonly elegido = signal<Pendiente | null>(null);

  protected readonly dinero = dinero;
  protected readonly nombreTipoDoc = nombreTipoDoc;
  protected readonly TRAMOS = TRAMOS;
  protected readonly ordenTramos = ORDEN_TRAMOS;

  /** Monto pendiente en soles (los de dólares se convierten al tipo de cambio de emisión). */
  private enSoles(p: Pendiente): number {
    return p.moneda === 'USD' ? p.pendiente * (p.tipoCambio ?? 0) : p.pendiente;
  }

  /** Antigüedad de saldos: total por tramo de atraso. */
  protected readonly antiguedad = computed(() => {
    const total = this.lista().reduce((s, p) => s + this.enSoles(p), 0);
    return ORDEN_TRAMOS.map((t) => {
      const items = this.lista().filter((p) => p.tramo === t);
      const monto = redondear(items.reduce((s, p) => s + this.enSoles(p), 0));
      return { tramo: t, ...TRAMOS[t], cantidad: items.length, monto, porcentaje: total ? (monto / total) * 100 : 0 };
    });
  });

  protected readonly totales = computed(() => {
    const l = this.lista();
    const vencido = l.filter((p) => p.diasVencido > 0);
    return {
      total: redondear(l.reduce((s, p) => s + this.enSoles(p), 0)),
      vencido: redondear(vencido.reduce((s, p) => s + this.enSoles(p), 0)),
      cantidad: l.length,
      terceros: new Set(l.map((p) => p.terceroId)).size,
      detraccion: l.reduce((s, p) => s + (p.detraccionMonto > 0 && p.pagado === 0 ? p.detraccionMonto : 0), 0),
    };
  });

  protected readonly visibles = computed(() => {
    const t = this.texto().trim().toLowerCase();
    const tr = this.tramo();
    return this.lista()
      .filter((p) => !tr || p.tramo === tr)
      .filter((p) => !t || `${p.serie}-${p.numero} ${p.terceroNombre} ${p.terceroDocumento}`.toLowerCase().includes(t));
  });

  /** Vista agrupada por cliente / proveedor. */
  protected readonly grupos = computed(() => {
    const mapa = new Map<string, { id: string; nombre: string; documento: string; cantidad: number; monto: number; vencido: number; maxDias: number }>();
    for (const p of this.visibles()) {
      const g = mapa.get(p.terceroId) ?? {
        id: p.terceroId,
        nombre: p.terceroNombre,
        documento: `${p.terceroTipoDocumento} ${p.terceroDocumento}`,
        cantidad: 0,
        monto: 0,
        vencido: 0,
        maxDias: 0,
      };
      g.cantidad++;
      g.monto += this.enSoles(p);
      if (p.diasVencido > 0) g.vencido += this.enSoles(p);
      g.maxDias = Math.max(g.maxDias, p.diasVencido);
      mapa.set(p.terceroId, g);
    }
    return [...mapa.values()].sort((a, b) => b.monto - a.monto);
  });

  constructor() {
    effect(() => {
      this.operacion();
      untracked(() => {
        this.tramo.set(null);
        void this.cargar();
      });
    });
    void this.store.asegurar();
  }

  protected async cargar() {
    this.cargando.set(true);
    try {
      this.lista.set(await this.api.pendientes(this.operacion()));
    } catch (e) {
      this.store.error('No se pudo cargar', e);
    } finally {
      this.cargando.set(false);
    }
  }

  protected filtrarTramo(t: Tramo) {
    this.tramo.update((actual) => (actual === t ? null : t));
  }

  protected registrar(p: Pendiente) {
    this.elegido.set(p);
    this.dialogo.set(true);
  }

  protected async registrado() {
    this.store.ok(this.esCobro() ? 'Cobro registrado' : 'Pago registrado', 'Se actualizó el saldo de caja y bancos y el Libro Diario.');
    await Promise.all([this.cargar(), this.store.recargar()]);
  }

  protected atraso(p: Pendiente): string {
    if (p.diasVencido > 0) return `${p.diasVencido} día${p.diasVencido === 1 ? '' : 's'} vencido`;
    if (p.diasVencido === 0) return 'Vence hoy';
    return `Vence en ${-p.diasVencido} día${p.diasVencido === -1 ? '' : 's'}`;
  }

  protected exportar() {
    const filas = this.lista().map((p) => ({
      [this.esCobro() ? 'Cliente' : 'Proveedor']: p.terceroNombre,
      Documento: `${p.terceroTipoDocumento} ${p.terceroDocumento}`,
      Comprobante: `${p.serie}-${p.numero}`,
      Tipo: nombreTipoDoc(p.tipoDoc),
      Emisión: p.fechaEmision,
      Vencimiento: p.fechaVencimiento,
      'Días de atraso': Math.max(p.diasVencido, 0),
      Tramo: TRAMOS[p.tramo].nombre,
      Moneda: p.moneda,
      Total: p.total,
      Pagado: p.pagado,
      'Notas de crédito': p.notasCredito,
      Pendiente: p.pendiente,
    }));
    descargarCsv(filas, `${this.esCobro() ? 'cuentas-por-cobrar' : 'cuentas-por-pagar'}.csv`);
  }
}
