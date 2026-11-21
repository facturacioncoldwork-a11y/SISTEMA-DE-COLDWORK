import type { Area, Rol } from '../permisos/areas';
import { portalDe, RUTA_PORTAL } from '../permisos/portales';

/**
 * Elegir empresa al entrar.
 * Una misma cuenta puede pertenecer a varias empresas con un rol distinto en cada una
 * (ej. contadora en COLDWORK y dueña de su propio negocio). Cada empresa está aislada.
 */

/** Con más de una empresa, se pregunta a cuál entrar una vez por sesión. */
export function necesitaElegir(cantidadEmpresas: number, yaEligio: boolean): boolean {
  return cantidadEmpresas > 1 && !yaEligio;
}

/** Ruta a la que va la persona según su rol en la empresa elegida. */
export function destinoDe(empresa: { rol: Rol; areas: readonly Area[] }): string {
  return RUTA_PORTAL[portalDe(empresa.rol, empresa.areas)];
}

/** Texto corto del lugar al que entra: para mostrar en la tarjeta de cada empresa. */
export function nombreDestino(empresa: { rol: Rol; areas: readonly Area[] }): string {
  return portalDe(empresa.rol, empresa.areas) === 'contable' ? 'Portal contable' : 'Sistema completo';
}
