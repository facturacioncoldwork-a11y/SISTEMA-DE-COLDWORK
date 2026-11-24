import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { filter, map, startWith } from 'rxjs';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import type { Area } from '../../../../core/permisos/areas';
import { FinanzasStore } from '../../services/finanzas-store.service';

interface Pestana {
  ruta: string;
  etiqueta: string;
  icono: string;
  area: Area | null;
  exacta?: boolean;
}

/** Contenedor del módulo: cabecera, pestañas (según las áreas de cada persona) y la vista hija. */
@Component({
  selector: 'app-finanzas',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmDialogModule],
  providers: [ConfirmationService],
  templateUrl: './finanzas.html',
})
export class Finanzas {
  private readonly router = inject(Router);
  private readonly empresa = inject(EmpresaActualService);
  protected readonly store = inject(FinanzasStore);

  private readonly todas: Pestana[] = [
    { ruta: '/finanzas', etiqueta: 'Panel', icono: 'pi pi-th-large', area: 'finanzas', exacta: true },
    { ruta: '/finanzas/ventas', etiqueta: 'Ventas', icono: 'pi pi-arrow-up-right', area: 'ventas' },
    { ruta: '/finanzas/compras', etiqueta: 'Compras', icono: 'pi pi-arrow-down-left', area: 'contabilidad' },
    { ruta: '/finanzas/caja-bancos', etiqueta: 'Caja y bancos', icono: 'pi pi-wallet', area: 'finanzas' },
    { ruta: '/finanzas/cuentas-cobrar', etiqueta: 'Por cobrar', icono: 'pi pi-inbox', area: 'finanzas' },
    { ruta: '/finanzas/cuentas-pagar', etiqueta: 'Por pagar', icono: 'pi pi-send', area: 'finanzas' },
    { ruta: '/finanzas/terceros', etiqueta: 'Clientes y proveedores', icono: 'pi pi-users', area: null },
  ];

  protected readonly pestanas = computed(() => {
    this.empresa.actual();
    return this.todas.filter((p) => !p.area || this.empresa.puede(p.area));
  });

  /** Título y subtítulo de la vista hija actual (data de la ruta). */
  private readonly datos = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let r = this.router.routerState.snapshot.root;
        while (r.firstChild) r = r.firstChild;
        return (r.data ?? {}) as { titulo?: string; sub?: string };
      }),
    ),
    { initialValue: {} as { titulo?: string; sub?: string } },
  );
  protected readonly titulo = computed(() => this.datos().titulo ?? 'Finanzas');
  protected readonly sub = computed(() => this.datos().sub ?? '');

  protected readonly puedeVender = computed(() => {
    this.empresa.actual();
    return this.empresa.puede('ventas');
  });
  protected readonly puedeCaja = computed(() => {
    this.empresa.actual();
    return this.empresa.puede('finanzas');
  });

  /** Globo en "Por cobrar": deuda vencida de clientes. */
  protected readonly vencido = computed(() => (this.store.resumen()?.porCobrarVencido ?? 0) > 0);

  constructor() {
    // Al cambiar de empresa, los catálogos son otros
    effect(() => {
      this.empresa.id();
      this.store.limpiar();
      void this.store.asegurar();
    });
  }

  protected ir(ruta: string) {
    void this.router.navigate([ruta], { queryParams: { nuevo: 1 } });
  }
}
