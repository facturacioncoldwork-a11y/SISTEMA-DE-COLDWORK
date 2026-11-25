import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AvisoSimulacion } from '../../../../shared/components/aviso-simulacion/aviso-simulacion';

/** Contenedor del área "Servicios y proyectos" (coordinación). */
@Component({
  selector: 'app-proyectos',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AvisoSimulacion],
  template: `
    <div class="lg">
      <header class="lg-hero">
        <div class="lg-hero__fila">
          <div>
            <div class="lg-hero__miga"><i class="pi pi-briefcase"></i> Servicios y proyectos</div>
            <h1 class="lg-hero__titulo">{{ datos().titulo ?? 'Servicios y proyectos' }}</h1>
            <p class="lg-hero__sub">{{ datos().sub ?? '' }}</p>
          </div>
        </div>
        <nav class="lg-nav no-imprimir" aria-label="Servicios y proyectos">
          <a routerLink="/proyectos" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }"><i class="pi pi-th-large"></i> Panel</a>
          <a routerLink="/proyectos/cotizaciones" routerLinkActive="activo"><i class="pi pi-file-edit"></i> Cotizaciones</a>
          <a routerLink="/servicios" ><i class="pi pi-wrench"></i> Área técnica →</a>
        </nav>
      </header>
      <div class="lg-cuerpo">
        <app-aviso-simulacion />
        <router-outlet />
      </div>
    </div>
  `,
})
export class Proyectos {
  private readonly router = inject(Router);
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
