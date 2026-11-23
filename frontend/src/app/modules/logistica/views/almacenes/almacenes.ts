import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AlmacenDialogo } from '../../components/almacen-dialogo/almacen-dialogo';
import { TIPOS_ALMACEN, type Almacen } from '../../models/logistica.model';
import { LogisticaStore } from '../../services/logistica-store.service';

/** Vista: ALMACENES (principal, unidades móviles y obras). */
@Component({
  selector: 'app-almacenes',
  imports: [CurrencyPipe, DecimalPipe, AlmacenDialogo],
  templateUrl: './almacenes.html',
  styleUrl: './almacenes.scss',
})
export class Almacenes implements OnInit {
  protected readonly store = inject(LogisticaStore);
  private readonly router = inject(Router);

  protected readonly tipos = TIPOS_ALMACEN;
  protected readonly dialogo = signal(false);
  protected readonly editando = signal<Almacen | null>(null);
  protected readonly total = computed(
    () => this.store.almacenes().reduce((t, a) => t + a.valorizado, 0) || 1,
  );

  /** Los 3 productos con más valor en cada almacén. */
  protected readonly top = computed(() => {
    const m = new Map<string, { nombre: string; cantidad: number; unidad: string }[]>();
    for (const a of this.store.almacenes()) {
      m.set(
        a.id,
        this.store
          .productos()
          .map((p) => ({ p, c: p.stock.find((s) => s.almacenId === a.id)?.cantidad ?? 0 }))
          .filter((x) => x.c > 0)
          .sort((x, y) => y.c * y.p.costoPromedio - x.c * x.p.costoPromedio)
          .slice(0, 3)
          .map((x) => ({ nombre: x.p.nombre, cantidad: x.c, unidad: x.p.unidad })),
      );
    }
    return m;
  });

  async ngOnInit() {
    await this.store.asegurar();
  }

  protected abrir(a: Almacen | null) {
    this.editando.set(a);
    this.dialogo.set(true);
  }

  protected transferir() {
    void this.router.navigate(['/logistica/salidas'], { queryParams: { nuevo: 1 } });
  }
}
