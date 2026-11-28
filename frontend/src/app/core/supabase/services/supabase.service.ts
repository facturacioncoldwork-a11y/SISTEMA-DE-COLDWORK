import { Injectable } from '@angular/core';
import { GoTrueClient } from '@supabase/auth-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../../config/runtime-config';

/**
 * Supabase en el navegador, cargando solo lo que se usa:
 *  - `auth`: inicio de sesión (se carga al abrir la app).
 *  - `cliente()`: archivos privados y tiempo real; se descarga recién la primera vez que una
 *    pantalla lo usa. Así abrir la app no espera por lo que no necesita.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly auth: GoTrueClient;
  private readonly url: string;
  private readonly key: string;

  constructor() {
    const { supabaseUrl, supabaseKey } = getConfig();
    this.url = supabaseUrl.replace(/\/$/, '');
    this.key = supabaseKey;
    // Mismas opciones que usaba createClient (la sesión guardada se sigue reconociendo)
    this.auth = new GoTrueClient({
      url: `${this.url}/auth/v1`,
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      storageKey: 'coldwork-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    });
  }

  private completo: Promise<SupabaseClient> | null = null;

  /**
   * Cliente completo (archivos privados y tiempo real), descargado recién la primera vez que una
   * pantalla lo pide. Usa la sesión de `auth` (no inicia sesión por su cuenta).
   */
  cliente(): Promise<SupabaseClient> {
    this.completo ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(this.url, this.key, {
        accessToken: async () => (await this.auth.getSession()).data.session?.access_token ?? null,
      }),
    );
    return this.completo;
  }
}
