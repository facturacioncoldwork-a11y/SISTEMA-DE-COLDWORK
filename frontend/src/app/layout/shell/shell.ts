import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { EmpresaActualService } from '../../core/empresa/services/empresa-actual.service';
import { getConfig } from '../../core/config/runtime-config';
import { Logo } from '../../shared/components/logo/logo';
import { MenuCuenta } from '../../shared/components/menu-cuenta/menu-cuenta';
import { MENU } from './menu';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, Logo, MenuCuenta],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell implements OnInit {
  protected readonly empresa = inject(EmpresaActualService);
  private readonly router = inject(Router);
  private readonly avisos = inject(MessageService);

  protected readonly entorno = getConfig().entorno;
  protected readonly abierto = signal(false);

  /** Menú filtrado: cada persona ve solo sus áreas; los grupos vacíos se ocultan. */
  protected readonly menu = computed(() => {
    this.empresa.actual(); // recalcula al cambiar de empresa
    return MENU.map((g) => ({
      ...g,
      items: g.items.filter((i) =>
        i.soloDueno
          ? this.empresa.esDueno()
          : i.soloAdmin
            ? this.empresa.esAdmin()
            : !i.area || this.empresa.puede(i.area),
      ),
    })).filter((g) => g.items.length > 0);
  });

  async ngOnInit() {
    try {
      const lista = await this.empresa.asegurar();
      // Cuenta nueva sin empresa → pantalla "Crea tu empresa"
      if (lista.length === 0 && !this.router.url.startsWith('/empresa/nueva')) {
        await this.router.navigateByUrl('/empresa/nueva');
      }
    } catch (e) {
      const sinApi = e instanceof HttpErrorResponse && e.status === 0;
      this.avisos.add({
        severity: 'warn',
        summary: sinApi ? 'API sin conexión' : 'No se pudieron cargar tus empresas',
        detail: sinApi
          ? 'Revisa que la API (NestJS) esté encendida.'
          : ((e as HttpErrorResponse)?.error?.message as string | undefined),
        life: 6000,
      });
    }
  }
}
