import { HttpErrorResponse } from '@angular/common/http';

/**
 * Texto para el usuario a partir de un error de la API (una sola versión para toda la app).
 * El backend ya responde mensajes en español pensados para el usuario.
 */
export function mensajeError(e: unknown): string | undefined {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'El servidor no responde. Intenta de nuevo en unos segundos.';
    const m = (e.error as { message?: string | string[] } | null)?.message;
    return Array.isArray(m) ? m.join(' · ') : m;
  }
  return e instanceof Error ? e.message : undefined;
}
