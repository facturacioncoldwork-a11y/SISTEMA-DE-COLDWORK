import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { Emoji } from '../../../../shared/components/emoji/emoji';
import { Logo } from '../../../../shared/components/logo/logo';
import { BotonGoogle } from '../../components/boton-google/boton-google';

/** Vista: crear cuenta nueva. */
@Component({
  selector: 'app-registro',
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, MessageModule, Emoji, Logo, BotonGoogle],
  templateUrl: './registro.html',
  styleUrl: '../login/login.scss',
})
export class Registro {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  nombre = '';
  correo = '';
  clave = '';
  clave2 = '';
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  /** Correo al que se envió el enlace de confirmación. */
  readonly enviadoA = signal<string | null>(null);

  async crear() {
    const error = this.validar();
    if (error) {
      this.error.set(error);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    const r = await this.auth.registrar(this.nombre.trim(), this.correo.trim().toLowerCase(), this.clave);
    this.cargando.set(false);
    if (r.error) {
      this.error.set(r.error);
      return;
    }
    if (r.pendienteConfirmar) {
      this.enviadoA.set(this.correo.trim().toLowerCase());
      return;
    }
    await this.router.navigateByUrl('/');
  }

  private validar(): string | null {
    if (this.nombre.trim().length < 2) return 'Escribe tu nombre.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.correo.trim())) return 'Escribe un correo válido.';
    if (this.clave.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (this.clave !== this.clave2) return 'Las contraseñas no coinciden.';
    return null;
  }
}
