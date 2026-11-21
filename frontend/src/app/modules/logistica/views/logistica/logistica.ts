import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { filter, map, startWith } from 'rxjs';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import { nivelStock } from '../../models/logistica.model';
import { LogisticaStore } from '../../services/logistica-store.service';

interface Pestana {
  ruta: string;
  etiqueta: string;
  icono: string;
  exacta?: boolean;
}

/** Contenedor del módulo: cabecera aurora, pestañas y la vista hija. */
@Component({
  selector: 'app-logistica',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmDialogModule],
  // Un solo diálogo de confirmación para todo el módulo (ver services/confirmar.ts)
  providers: [ConfirmationService],
  templateUrl: './logistica.html',
})
export class Logistica {
  private readonly router = inject(Router);
  private readonly empresa = inject(EmpresaActualService);
  protected readonly store = inject(LogisticaStore);

  protected readonly pestanas: Pestana[] = [
    { ruta: '/logistica', etiqueta: 'Panel', icono: 'pi pi-th-large', exacta: true },
    { ruta: '/logistica/inventario', etiqueta: 'Inventario', icono: 'pi pi-box' },
    { ruta: '/logistica/llegadas', etiqueta: 'Llegadas', icono: 'pi pi-download' },
    { ruta: '/logistica/salidas', etiqueta: 'Salidas', icono: 'pi pi-upload' },
    { ruta: '/logistica/ordenes-compra', etiqueta: 'Órdenes de compra', icono: 'pi pi-file-edit' },
    { ruta: '/logistica/proveedores', etiqueta: 'Proveedores', icono: 'pi pi-truck' },
    { ruta: '/logistica/almacenes', etiqueta: 'Almacenes', icono: 'pi pi-warehouse' },
  ];

  /** Título y subtítulo de la vista hija actual (data de la ruta). */
  private readonly datos = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        // Se lee del estado del router (siempre listo), no de ActivatedRoute.firstChild:
        // al entrar desde otra pantalla, la ruta hija aún no tiene snapshot.
        let r = this.router.routerState.snapshot.root;
        while (r.firstChild) r = r.firstChild;
        return (r.data ?? {}) as { titulo?: string; sub?: string };
      }),
    ),
    { initialValue: {} as { titulo?: string; sub?: string } },
  );
  protected readonly titulo = computed(() => this.datos().titulo ?? 'Almacén y logística');
  protected readonly sub = computed(() => this.datos().sub ?? '');

  /** Productos en rojo o naranja: se muestran como globo en "Inventario". */
  protected readonly alertas = computed(
    () =>
      this.store
        .productosActivos()
        .filter((p) => ['agotado', 'critico'].includes(nivelStock(p.stockTotal, p.stockMinimo)))
        .length,
  );

  constructor() {
    // Al cambiar de empresa, los catálogos son otros
    effect(() => {
      this.empresa.id();
      this.store.limpiar();
      void this.store.asegurar();
    });
  }

  protected ir(ruta: string, nuevo = true) {
    void this.router.navigate([ruta], { queryParams: nuevo ? { nuevo: 1 } : {} });
  }
}
