import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { nombreArea, NOMBRE_ROL } from '../../../../core/permisos/areas';
import { Logo } from '../../../../shared/components/logo/logo';
import { BotonGoogle } from '../../components/boton-google/boton-google';
import { INVITACION_DEMO } from '../../data/invitacion-ejemplo';
import { problemasClave } from '../../utils/clave';

/**
 * Pantalla que abre el trabajador desde el enlace de invitación (correo o WhatsApp).
 * Crea su contraseña (o entra con Google con el mismo correo) y queda dentro de la empresa.
 *
 * SIMULACIÓN: solo el código "demo" existe; no crea cuentas reales.
 */
@Component({
  selector: 'app-aceptar-invitacion',
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, PasswordModule, Logo, BotonGoogle],
  templateUrl: './aceptar-invitacion.html',
  styleUrls: ['../login/login.scss', './aceptar-invitacion.scss'],
})
export class AceptarInvitacion {
  private readonly router = inject(Router);

  /** Código del enlace: /invitacion/:codigo */
  readonly codigo = input<string>();

  protected readonly invitacion = computed(() => (this.codigo() === 'demo' ? INVITACION_DEMO : null));
  protected readonly rol = computed(() => {
    const i = this.invitacion();
    return i ? NOMBRE_ROL[i.rol] : '';
  });
  protected readonly areas = computed(() => this.invitacion()?.areas.map(nombreArea).join(', ') ?? '');

  protected nombre = INVITACION_DEMO.nombre;
  protected clave = '';
  protected clave2 = '';
  protected acepta = false;
  protected readonly errores = signal<string[]>([]);
  protected readonly listo = signal(false);

  protected crear() {
    const errores = problemasClave(this.clave, this.clave2);
    if (!this.nombre.trim()) errores.unshift('Escribe tu nombre.');
    if (!this.acepta) errores.push('Debes aceptar el tratamiento de tus datos para continuar.');
    this.errores.set(errores);
    if (errores.length === 0) this.listo.set(true);
  }

  /** SIMULACIÓN: entrar al portal (con la sesión actual del dueño). */
  protected entrar() {
    void this.router.navigateByUrl('/trabajo');
  }
}
