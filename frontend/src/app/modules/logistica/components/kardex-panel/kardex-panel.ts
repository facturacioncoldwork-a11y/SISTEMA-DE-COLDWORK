import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { TIPOS_PRODUCTO, type Movimiento, type Producto } from '../../models/logistica.model';
import { LogisticaStore } from '../../services/logistica-store.service';
import { ProductosService } from '../../services/productos.service';
import { MedidorStock } from '../medidor-stock/medidor-stock';

/** Panel lateral de un producto: stock por almacén y kardex (línea de tiempo). */
@Component({
  selector: 'app-kardex-panel',
  imports: [DrawerModule, CurrencyPipe, DatePipe, DecimalPipe, MedidorStock],
  templateUrl: './kardex-panel.html',
  styleUrl: './kardex-panel.scss',
})
export class KardexPanel {
  private readonly api = inject(ProductosService);
  protected readonly store = inject(LogisticaStore);

  readonly visible = model(false);
  readonly producto = input<Producto | null>(null);
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

  protected nombreAlmacen(id: string): string {
    return this.store.almacenPorId().get(id)?.nombre ?? '—';
  }
}
