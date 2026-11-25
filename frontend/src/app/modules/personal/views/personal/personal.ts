import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AvisoSimulacion } from '../../../../shared/components/aviso-simulacion/aviso-simulacion';

/** Contenedor de Personal (asistencia). */
@Component({
  selector: 'app-personal',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AvisoSimulacion],
  template: `
    <div class="lg">
      <header class="lg-hero">
        <div class="lg-hero__fila">
          <div>
            <div class="lg-hero__miga"><i class="pi pi-id-card"></i> Personal</div>
            <h1 class="lg-hero__titulo">{{ datos().titulo ?? 'Asistencia' }}</h1>
            <p class="lg-hero__sub">{{ datos().sub ?? '' }}</p>
          </div>
        </div>
        <nav class="lg-nav no-imprimir" aria-label="Asistencia">
          <a routerLink="/personal" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }"><i class="pi pi-th-large"></i> Hoy</a>
          <a routerLink="/personal/marcar" routerLinkActive="activo"><i class="pi pi-mobile"></i> Marcar</a>
          <a routerLink="/personal/registro" routerLinkActive="activo"><i class="pi pi-calendar"></i> Registro mensual</a>
          <a routerLink="/personal/horario" routerLinkActive="activo"><i class="pi pi-cog"></i> Horario y métodos</a>
        </nav>
      </header>
      <div class="lg-cuerpo">
        <app-aviso-simulacion />
        <router-outlet />
      </div>
    </div>
  `,
})
export class Personal {
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
