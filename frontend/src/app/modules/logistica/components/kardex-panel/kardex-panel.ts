import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DrawerModule } from 'primeng/drawer';
import {
  mesesEntre,
  nivelAntiguedad,
  NIVELES_ANTIGUEDAD,
  textoAntiguedad,
} from '../../models/antiguedad';
import {
  TIPOS_PRODUCTO,
  type Lote,
  type Movimiento,
  type Producto,
} from '../../models/logistica.model';
import { LogisticaStore } from '../../services/logistica-store.service';
import { MovimientosService } from '../../services/movimientos.service';
import { ProductosService } from '../../services/productos.service';
import { MedidorStock } from '../medidor-stock/medidor-stock';

/** Panel lateral de un producto: stock por almacén y kardex (línea de tiempo). */
@Component({
  selector: 'app-kardex-panel',
  imports: [DrawerModule, FormsModule, CurrencyPipe, DatePipe, DecimalPipe, MedidorStock],
  templateUrl: './kardex-panel.html',
  styleUrl: './kardex-panel.scss',
})
export class KardexPanel {
  private readonly api = inject(ProductosService);
  private readonly movimientosApi = inject(MovimientosService);
  protected readonly store = inject(LogisticaStore);

  readonly visible = model(false);
  readonly producto = input<Producto | null>(null);
  /** Versión al día del producto (cambia al recargar el almacén, p. ej. al corregir una fecha). */
  protected readonly actual = computed(() => {
    const p = this.producto();
    return p ? (this.store.productoPorId().get(p.id) ?? p) : null;
  });
  protected readonly edad = computed(() => {
    const p = this.actual();
    return p ? this.store.antiguedad().get(p.id) : undefined;
  });
  protected readonly niveles = NIVELES_ANTIGUEDAD;
  protected readonly textoAntiguedad = textoAntiguedad;
  protected readonly hoy = new Date().toISOString().slice(0, 10);
  /** Lote cuya fecha de ingreso se está corrigiendo. */
  protected readonly editandoLote = signal<string | null>(null);
  protected readonly nuevaFecha = signal('');
  protected readonly guardando = signal(false);
  readonly editar = output<Producto>();
  readonly pedir = output<Producto>();

  protected readonly movimientos = signal<Movimiento[]>([]);
  protected readonly cargando = signal(false);
  protected readonly filtroAlmacen = signal<string | null>(null);
  protected readonly tipos = TIPOS_PRODUCTO;

  protected readonly visibles = computed(() => {
    const f = this.filtroAlmacen();
    return f ? this.movimientos().filter((m) => m.almacenId === f) : this.movimientos();
  });
  protected readonly entradas = computed(() =>
    this.visibles()
      .filter((m) => m.tipo === 'entrada')
      .reduce((t, m) => t + m.cantidad, 0),
  );
  protected readonly salidas = computed(() =>
    this.visibles()
      .filter((m) => m.tipo === 'salida')
      .reduce((t, m) => t + m.cantidad, 0),
  );

  constructor() {
    effect(() => {
      const p = this.producto();
      if (p && this.visible()) void this.cargar(p.id);
    });
  }

  private async cargar(id: string) {
    this.cargando.set(true);
    this.filtroAlmacen.set(null);
    try {
      this.movimientos.set(await this.api.kardex(id));
    } catch (e) {
      this.movimientos.set([]);
      this.store.error('No se pudo cargar el kardex', e);
    } finally {
      this.cargando.set(false);
    }
  }

  protected nivelLote(l: Lote) {
    return nivelAntiguedad(mesesEntre(new Date(l.fecha), new Date()), this.store.mesesAntiguedad());
  }

  protected editarFecha(l: Lote) {
    this.editandoLote.set(l.llegadaId);
    this.nuevaFecha.set(l.fecha.slice(0, 10));
  }

  /** Corrige la fecha de ingreso: cambia la fecha de esa llegada (y su kardex). */
  protected async guardarFecha(l: Lote) {
    const d = this.nuevaFecha();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > this.hoy) {
      this.store.error('Fecha inválida', new Error('Elige una fecha de hoy o anterior.'));
      return;
    }
    this.guardando.set(true);
    try {
      await this.movimientosApi.actualizarLlegada(l.llegadaId, {
        fecha: new Date(`${d}T12:00:00`).toISOString(),
      });
      this.editandoLote.set(null);
      await this.store.recargar();
      const p = this.actual();
      if (p) await this.cargar(p.id);
      this.store.ok('Fecha de ingreso corregida', `${l.documento} ahora figura desde ${d}`);
    } catch (e) {
      this.store.error('No se pudo cambiar la fecha', e);
    } finally {
      this.guardando.set(false);
    }
  }

  protected nombreAlmacen(id: string): string {
    return this.store.almacenPorId().get(id)?.nombre ?? '—';
  }
}
