import { Component, computed, inject, input, output, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Popover, PopoverModule } from 'primeng/popover';
import { AuthService } from '../../../core/auth/services/auth.service';
import { destinoDe, iniciales, nombreDestino } from '../../../core/empresa/eleccion';
import { EmpresaActualService } from '../../../core/empresa/services/empresa-actual.service';
import { NOMBRE_ROL } from '../../../core/permisos/areas';
import type { MiEmpresa } from '../../../modules/empresas/models/empresa.model';

/**
 * Menú de la cuenta (arriba a la derecha), como en Google o Slack:
 * quién soy, mis empresas para cambiar de una a otra, crear empresa y cerrar sesión.
 * Se usa en el ERP y en los portales de trabajadores.
 */
@Component({
  selector: 'app-menu-cuenta',
  imports: [RouterLink, PopoverModule],
  templateUrl: './menu-cuenta.html',
  styleUrl: './menu-cuenta.scss',
})
export class MenuCuenta {
  private readonly auth = inject(AuthService);
  private readonly empresa = inject(EmpresaActualService);
  private readonly router = inject(Router);

  /** Nombre a mostrar (por defecto, el correo). */
  readonly nombre = input<string | null>(null);

  // ─── SIMULACIÓN (se quita al conectar cuentas reales) ─────────
  /** Otra persona simulada: su correo, sus empresas y en cuál está. */
  readonly simCorreo = input<string | null>(null);
  readonly simEmpresas = input<MiEmpresa[] | null>(null);
  readonly simActualId = input<string | null>(null);
  readonly elegirSimulada = output<MiEmpresa>();

  protected readonly popover = viewChild.required(Popover);

  protected readonly nombreRol = NOMBRE_ROL;
  protected readonly nombreDestino = nombreDestino;
  protected readonly iniciales = iniciales;

  protected readonly correo = computed(() => this.simCorreo() ?? this.auth.usuario()?.email ?? '');
  protected readonly mostrado = computed(() => this.nombre() || this.correo());
  protected readonly empresas = computed(() => this.simEmpresas() ?? this.empresa.empresas());
  protected readonly actualId = computed(() => (this.simEmpresas() ? this.simActualId() : this.empresa.id()));
  protected readonly actual = computed(() => this.empresas().find((e) => e.id === this.actualId()) ?? null);

  protected abrir(evento: Event) {
    this.popover().toggle(evento);
  }

  protected async cambiar(e: MiEmpresa) {
    this.popover().hide();
    if (e.id === this.actualId()) return;
    if (this.simEmpresas()) return this.elegirSimulada.emit(e);

    this.empresa.elegir(e.id);
    await this.router.navigateByUrl(destinoDe(e));
  }

  protected async salir() {
    this.popover().hide();
    await this.auth.salir();
    this.empresa.limpiar();
    await this.router.navigateByUrl('/login');
  }
}
