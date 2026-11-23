import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TIPOS_PRODUCTO, type Producto } from '../../models/logistica.model';
import { LogisticaStore } from '../../services/logistica-store.service';

/** Buscador de productos para agregar líneas. Muestra el stock del almacén elegido. */
@Component({
  selector: 'app-selector-producto',
  imports: [FormsModule, SelectModule],
  template: `
    @for (v of [vuelta()]; track v) {
      <p-select
        [options]="opciones()"
        optionLabel="etiqueta"
        [filter]="true"
        filterBy="etiqueta"
        placeholder="Buscar producto por nombre o SKU para agregarlo…"
        [ngModel]="valor()"
        (ngModelChange)="elegir($event)"
        appendTo="body"
        styleClass="w-full"
        emptyFilterMessage="Ningún producto coincide"
      >
        <ng-template #item let-o>
          <div class="op">
            <i [class]="info(o.p).icono" [style.color]="info(o.p).color"></i>
            <div>
              <strong>{{ o.p.nombre }}</strong><small>{{ o.p.sku }}</small>
            </div>
            @if (almacenId()) {
              <span [class.cero]="o.stock <= 0">{{ o.stock }} {{ o.p.unidad }}</span>
            }
          </div>
        </ng-template>
      </p-select>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .op {
      display: flex;
      gap: 0.7rem;
      align-items: center;
      width: 100%;
    }
    .op div {
      flex: 1;
      display: grid;
    }
    .op small {
      color: var(--lg-muted);
      font-size: 0.74rem;
    }
    .op span {
      font-size: 0.78rem;
      font-weight: 650;
      color: #059669;
    }
    .op span.cero {
      color: #dc2626;
    }
  `,
})
export class SelectorProducto {
  private readonly store = inject(LogisticaStore);
  readonly almacenId = input<string | null>(null);
  /** Productos que ya están en la lista (no se repiten). */
  readonly excluir = input<string[]>([]);
  readonly elegido = output<Producto>();

  protected readonly tipos = TIPOS_PRODUCTO;
  protected readonly valor = signal<unknown>(null);
  /** Al cambiar, el select se vuelve a crear vacío (listo para el siguiente producto). */
  protected readonly vuelta = signal(0);
  protected readonly opciones = computed(() => {
    const fuera = new Set(this.excluir());
    const alm = this.almacenId();
    return this.store
      .productosActivos()
      .filter((p) => !fuera.has(p.id))
      .map((p) => ({
        p,
        etiqueta: `${p.nombre} · ${p.sku}`,
        stock: alm ? this.store.stockEn(p.id, alm) : p.stockTotal,
      }));
  });

  protected info(p: Producto) {
    return this.tipos[p.tipo];
  }

  protected elegir(o: { p: Producto } | null) {
    if (!o) return;
    this.elegido.emit(o.p);
    this.vuelta.update((v) => v + 1);
  }
}
