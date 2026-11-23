import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { Logo } from '../../../../shared/components/logo/logo';
import { BotonGoogle } from '../../components/boton-google/boton-google';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, PasswordModule, MessageModule, Logo, BotonGoogle],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** ?volver=/ruta (lo pone el guard). */
  readonly volver = input<string>();

  correo = '';
  clave = '';
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  async entrar() {
    if (!this.correo || !this.clave) {
      this.error.set('Escribe tu correo y tu contraseña.');
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    const err = await this.auth.entrarConCorreo(this.correo.trim(), this.clave);
    this.cargando.set(false);
    if (err) {
      this.error.set(err);
      return;
    }
    await this.router.navigateByUrl(this.volver() || '/');
  }
}
