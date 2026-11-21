import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { destinoDe, iniciales, nombreDestino } from '../../../../core/empresa/eleccion';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import { NOMBRE_ROL } from '../../../../core/permisos/areas';
import { Emoji } from '../../../../shared/components/emoji/emoji';
import { EMPRESAS_MARIA } from '../../data/empresas-ejemplo';
import type { MiEmpresa } from '../../models/empresa.model';

/**
 * "¿A qué empresa quieres entrar?"
 * Aparece al iniciar sesión cuando la persona pertenece a más de una empresa,
 * y desde el botón "Cambiar de empresa". Cada empresa lleva a su portal según el rol.
 */
@Component({
  selector: 'app-elegir-empresa',
  imports: [RouterLink, ButtonModule, Emoji],
  templateUrl: './elegir-empresa.html',
  styleUrl: './elegir-empresa.scss',
})
export class ElegirEmpresa implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly empresa = inject(EmpresaActualService);
  private readonly router = inject(Router);
  private readonly avisos = inject(MessageService);

  protected readonly cargando = signal(true);
  /** El servidor no respondió: no es lo mismo que "no tienes empresas". */
  protected readonly sinConexion = signal(false);
  protected readonly nombreRol = NOMBRE_ROL;
  protected readonly nombreDestino = nombreDestino;
  protected readonly iniciales = iniciales;

  /** SIMULACIÓN: ver la pantalla como la vería María Quispe (contadora con negocio propio). */
  protected readonly comoMaria = signal(false);

  protected readonly lista = computed<MiEmpresa[]>(() => (this.comoMaria() ? EMPRESAS_MARIA : this.empresa.empresas()));
  protected readonly correo = computed(() => (this.comoMaria() ? 'maria.quispe@ejemplo.com' : (this.auth.usuario()?.email ?? '')));

  ngOnInit() {
    void this.cargar();
  }

  protected async cargar() {
    this.cargando.set(true);
    this.sinConexion.set(false);
    try {
      await this.empresa.asegurar();
    } catch {
      this.sinConexion.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  protected async entrar(e: MiEmpresa) {
    if (this.comoMaria()) return this.entrarSimulado(e);
    this.empresa.elegir(e.id);
    await this.router.navigateByUrl(destinoDe(e));
  }

  /** SIMULACIÓN: la empresa de COLDWORK abre el portal; la propia de María no existe de verdad. */
  private async entrarSimulado(e: MiEmpresa) {
    if (e.id === 'sim-coldwork') {
      const real = this.empresa.empresas()[0];
      if (real) this.empresa.elegir(real.id);
      await this.router.navigateByUrl('/trabajo');
      return;
    }
    this.avisos.add({
      severity: 'info',
      summary: 'Simulación',
      detail: `En "${e.razonSocial}" María es dueña: entraría a SU sistema completo, sin nada de COLDWORK.`,
      life: 6000,
    });
  }

  protected async salir() {
    await this.auth.salir();
    this.empresa.limpiar();
    await this.router.navigateByUrl('/login');
  }
}
