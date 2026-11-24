import { Component, computed, DestroyRef, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ComprobanteDialogo } from '../../components/comprobante-dialogo/comprobante-dialogo';
import { MotivoDialogo } from '../../components/motivo-dialogo/motivo-dialogo';
import { nombreTipoDoc } from '../../data/finanzas';
import type { Comprobante, Operacion } from '../../models/finanzas.model';
import { FinanzasApi } from '../../services/finanzas-api.service';
import { FinanzasStore, mensajeError } from '../../services/finanzas-store.service';
import { descargarCsv } from '../../utils/csv';
import { dinero, hoy, redondear } from '../../utils/calculos';

/** Vista de Ventas o de Compras (según la ruta): comprobantes del mes con su estado de cobro/pago. */
@Component({
  selector: 'app-comprobantes',
  imports: [FormsModule, RouterLink, ComprobanteDialogo, MotivoDialogo],
  templateUrl: './comprobantes.html',
  styleUrl: './comprobantes.scss',
})
export class Comprobantes implements OnInit {
  private readonly api = inject(FinanzasApi);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destruir = inject(DestroyRef);
  protected readonly store = inject(FinanzasStore);

  protected readonly operacion = toSignal(this.ruta.data.pipe(map((d) => d['operacion'] as Operacion)), {
    initialValue: 'venta' as Operacion,
  });
  protected readonly esVenta = computed(() => this.operacion() === 'venta');

  protected readonly mes = signal(hoy().slice(0, 7));
  protected readonly texto = signal('');
  protected readonly lista = signal<Comprobante[]>([]);
  protected readonly cargando = signal(false);
  protected readonly dialogo = signal(false);

  // Anulación
  protected readonly anulando = signal<Comprobante | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly errorAnular = signal<string | null>(null);

  protected readonly dinero = dinero;
  protected readonly nombreTipoDoc = nombreTipoDoc;

  protected readonly visibles = computed(() => {
    const t = this.texto().trim().toLowerCase();
    return this.lista().filter(
      (c) => !t || `${c.serie}-${c.numero} ${c.terceroNombre} ${c.terceroDocumento} ${c.glosa ?? ''}`.toLowerCase().includes(t),
    );
  });

  /** Totales del mes en soles (las notas de crédito restan; anulados no cuentan). */
  protected readonly totales = computed(() => {
    const validos = this.lista().filter((c) => c.estado === 'registrado');
    const signo = (c: Comprobante) => (c.tipoDoc === '07' ? -1 : 1);
    const f = (c: Comprobante) => (c.moneda === 'USD' ? (c.tipoCambio ?? 0) : 1);
    return {
      cantidad: validos.length,
      base: redondear(validos.reduce((s, c) => s + signo(c) * (c.baseGravada + c.noGravada) * f(c), 0)),
      igv: redondear(validos.reduce((s, c) => s + signo(c) * c.igv * f(c), 0)),
      pendiente: redondear(validos.reduce((s, c) => s + c.pendiente * f(c), 0)),
    };
  });

  constructor() {
    effect(() => {
      this.mes();
      this.operacion();
      untracked(() => void this.cargar());
    });
  }

  ngOnInit() {
    void this.store.asegurar();
    // ?nuevo=1 abre el formulario; se limpia para que no reaparezca al recargar
    this.ruta.queryParamMap.pipe(takeUntilDestroyed(this.destruir)).subscribe((q) => {
      if (!q.get('nuevo')) return;
      this.dialogo.set(true);
      void this.router.navigate([], { relativeTo: this.ruta, queryParams: {}, replaceUrl: true });
    });
  }

  protected async cargar() {
    const [anio, mes] = this.mes().split('-').map(Number);
    const ultimo = new Date(anio, mes, 0).getDate();
    this.cargando.set(true);
    try {
      this.lista.set(await this.api.comprobantes(this.operacion(), `${this.mes()}-01`, `${this.mes()}-${ultimo}`));
    } catch (e) {
      this.store.error('No se pudo cargar', e);
    } finally {
      this.cargando.set(false);
    }
  }

  protected async registrado() {
    this.store.ok(this.esVenta() ? 'Venta registrada' : 'Compra registrada', 'Su asiento ya está en el Libro Diario.');
    await Promise.all([this.cargar(), this.store.recargar()]);
  }

  protected async anular(motivo: string) {
    const c = this.anulando();
    if (!c) return;
    this.ocupado.set(true);
    this.errorAnular.set(null);
    try {
      await this.api.anularComprobante(c.id, motivo);
      this.anulando.set(null);
      this.store.ok('Comprobante anulado', 'Su asiento quedó anulado en el Libro Diario.');
      await Promise.all([this.cargar(), this.store.recargar()]);
    } catch (e) {
      this.errorAnular.set(mensajeError(e) ?? 'No se pudo anular.');
    } finally {
      this.ocupado.set(false);
    }
  }

  protected estado(c: Comprobante): { texto: string; clase: string } {
    if (c.estado === 'anulado') return { texto: 'Anulado', clase: 'agotado' };
    if (c.tipoDoc === '07') return { texto: 'Nota de crédito', clase: 'sin-punto' };
    if (c.pendiente <= 0) return { texto: this.esVenta() ? 'Cobrado' : 'Pagado', clase: 'ok' };
    if (c.fechaVencimiento < hoy()) return { texto: 'Vencido', clase: 'critico' };
    return { texto: c.pagado > 0 ? 'Pago parcial' : 'Pendiente', clase: 'bajo' };
  }

  /** Registro de Ventas / Compras del mes en CSV (base para el SIRE). */
  protected exportar() {
    const filas = this.lista().map((c) => ({
      Fecha: c.fechaEmision,
      Vencimiento: c.fechaVencimiento,
      Tipo: c.tipoDoc,
      Serie: c.serie,
      Numero: c.numero,
      'Tipo doc. identidad': c.terceroTipoDocumento,
      'N.° documento': c.terceroDocumento,
      'Razón social': c.terceroNombre,
      Moneda: c.moneda,
      'Tipo de cambio': c.tipoCambio ?? '',
      'Base gravada': c.baseGravada,
      'No gravado': c.noGravada,
      IGV: c.igv,
      Total: c.total,
      'Retención renta': c.retencionRenta,
      'Detracción %': c.detraccionPorcentaje,
      Estado: c.estado,
    }));
    descargarCsv(filas, `registro-${this.esVenta() ? 'ventas' : 'compras'}-${this.mes()}.csv`);
  }
}
