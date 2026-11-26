import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../../config/env.js';

/**
 * Fábrica de clientes de Supabase.
 *
 * `paraUsuario(token)` crea un cliente que actúa COMO ESE USUARIO: Postgres
 * aplica RLS con su identidad. La API no usa la secret key, así un error en
 * la API no puede saltarse los permisos de la base de datos.
 *
 * Crear un cliente por petición es barato (no abre conexiones: habla HTTP con
 * PostgREST) y mantiene la API sin estado → escala horizontalmente.
 */
@Injectable()
export class SupabaseService {
  private readonly url: string;
  private readonly key: string;

  constructor(config: ConfigService<Env, true>) {
    this.url = config.get('SUPABASE_URL', { infer: true });
    this.key = config.get('SUPABASE_KEY', { infer: true });
  }

  paraUsuario(token: string): SupabaseClient {
    return createClient(this.url, this.key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  /**
   * Cliente SIN usuario (rol anon). Solo para lo poco que se usa sin sesión, como la tablet de
   * asistencia: la base de datos solo le deja ejecutar esas funciones y exige un token válido.
   */
  publico(): SupabaseClient {
    return createClient(this.url, this.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  /** ¿Responde Supabase? (para /health/ready) */
  async disponible(timeoutMs = 8000): Promise<boolean> {
    try {
      const res = await fetch(`${this.url}/auth/v1/health`, {
        headers: { apikey: this.key },
        signal: AbortSignal.timeout(timeoutMs),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
