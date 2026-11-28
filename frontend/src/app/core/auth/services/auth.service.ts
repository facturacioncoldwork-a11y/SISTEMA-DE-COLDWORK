import { computed, inject, Injectable, signal } from '@angular/core';
import { Session, type User } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/services/supabase.service';
import { getConfig } from '../../config/runtime-config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  /** undefined = todavía no sabemos; null = sin sesión. */
  readonly session = signal<Session | null | undefined>(undefined);
  readonly usuario = computed(() => this.session()?.user ?? null);
  readonly logueado = computed(() => !!this.session());
  /** Nombre que la persona escribió al registrarse ('' si no hay). */
  readonly nombre = computed(() => nombreDeUsuario(this.usuario()));

  private listo: Promise<void>;

  constructor() {
    this.listo = this.supabase.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
    });
    this.supabase.auth.onAuthStateChange((_evento, session) => this.session.set(session));
  }

  /** Espera a que se sepa si hay sesión (lo usan los guards). */
  esperar(): Promise<void> {
    return this.listo;
  }

  async entrarConCorreo(correo: string, clave: string): Promise<string | null> {
    const { error } = await this.supabase.auth.signInWithPassword({ email: correo, password: clave });
    return error ? traducirError(error.message) : null;
  }

  /**
   * Crea una cuenta nueva. Si Supabase pide confirmar el correo, no hay sesión
   * hasta que la persona abra el enlace (pendienteConfirmar = true).
   */
  async registrar(nombre: string, correo: string, clave: string): Promise<ResultadoRegistro> {
    const { data, error } = await this.supabase.auth.signUp({
      email: correo,
      password: clave,
      options: { data: { nombre }, emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) return { error: traducirError(error.message), pendienteConfirmar: false };
    // Correo ya registrado: Supabase responde sin error pero con identities vacías
    if (data.user && data.user.identities?.length === 0) {
      return { error: 'Ese correo ya tiene una cuenta. Inicia sesión.', pendienteConfirmar: false };
    }
    return { error: null, pendienteConfirmar: !data.session };
  }

  /**
   * Entrar (o crear cuenta) con Google. Sale de la app hacia Google y vuelve
   * con la sesión iniciada. Requiere activar Google en Supabase → Authentication → Providers.
   */
  async entrarConGoogle(): Promise<string | null> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    return error ? traducirError(error.message) : null;
  }

  /** ¿Está activado el inicio con Google en Supabase? (endpoint público de ajustes de Auth) */
  async googleActivo(): Promise<boolean> {
    try {
      const { supabaseUrl, supabaseKey } = getConfig();
      const r = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey } });
      if (!r.ok) return false;
      const ajustes = (await r.json()) as { external?: Record<string, boolean> };
      return ajustes.external?.['google'] === true;
    } catch {
      return false;
    }
  }

  async salir(): Promise<void> {
    await this.supabase.auth.signOut({ scope: 'local' });
  }

  /** Cierra la sesión en TODOS los dispositivos (ej. si perdiste el celular o usaste una PC ajena). */
  async salirDeTodo(): Promise<void> {
    await this.supabase.auth.signOut({ scope: 'global' });
  }
}

export interface ResultadoRegistro {
  error: string | null;
  pendienteConfirmar: boolean;
}

function traducirError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Confirma tu correo antes de entrar (revisa tu bandeja y spam).';
  if (/already registered|already been registered/i.test(msg)) return 'Ese correo ya tiene una cuenta. Inicia sesión.';
  if (/password should be at least|weak password/i.test(msg)) return 'La contraseña es muy débil: usa al menos 8 caracteres.';
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espera unos minutos y vuelve a intentar.';
  if (/invalid.*email|email.*invalid/i.test(msg)) return 'El correo no es válido.';
  if (/fetch|network/i.test(msg)) return 'Sin conexión con el servidor.';
  if (/provider is not enabled|unsupported provider/i.test(msg)) return 'El inicio con Google aún no está activado.';
  return msg;
}

/**
 * Nombre de la persona: el que escribió al crear su cuenta (metadato `nombre`)
 * o, si entró con Google, el que trae Google (`full_name` / `name`).
 */
export function nombreDeUsuario(u: Pick<User, 'user_metadata'> | null | undefined): string {
  const m = (u?.user_metadata ?? {}) as Record<string, unknown>;
  for (const k of ['nombre', 'full_name', 'name']) {
    const v = m[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}
