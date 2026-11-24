import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

/** Contenedor de Reportes: cabecera, pestañas y el reporte elegido. */
@Component({
  selector: 'app-reportes',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="lg">
      <header class="lg-hero">
        <div class="lg-hero__fila">
          <div>
            <div class="lg-hero__miga"><i class="pi pi-chart-bar"></i> Reportes</div>
            <h1 class="lg-hero__titulo">{{ datos().titulo ?? 'Reportes' }}</h1>
            <p class="lg-hero__sub">{{ datos().sub ?? '' }}</p>
          </div>
          <a class="lg-cta lg-cta--vidrio no-imprimir" routerLink="/contabilidad/libros-sunat">
            <i class="pi pi-book"></i> Libros electrónicos
          </a>
        </div>
        <nav class="lg-nav" aria-label="Reportes">
          @for (p of pestanas; track p.ruta) {
            <a [routerLink]="p.ruta" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }">
              <i [class]="p.icono"></i> {{ p.etiqueta }}
            </a>
          }
        </nav>
      </header>
      <div class="lg-cuerpo">
        <router-outlet />
      </div>
    </div>
  `,
})
export class Reportes {
  private readonly router = inject(Router);

  protected readonly pestanas = [
    { ruta: '/reportes', etiqueta: 'Estado de resultados', icono: 'pi pi-chart-line' },
    { ruta: '/reportes/situacion', etiqueta: 'Situación financiera', icono: 'pi pi-building' },
    { ruta: '/reportes/tributario', etiqueta: 'Resumen tributario', icono: 'pi pi-percentage' },
  ];

  protected readonly datos = toSignal(
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
}
