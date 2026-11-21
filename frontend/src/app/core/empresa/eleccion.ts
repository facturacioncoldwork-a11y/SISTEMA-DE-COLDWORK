import type { Area, Rol } from '../permisos/areas';
import { portalDe, RUTA_PORTAL } from '../permisos/portales';

/**
 * Elegir empresa al entrar.
 * Una misma cuenta puede pertenecer a varias empresas con un rol distinto en cada una
 * (ej. contadora en COLDWORK y dueña de su propio negocio). Cada empresa está aislada.
 *
 * Forma moderna: se entra directo a la ÚLTIMA empresa usada y se cambia desde el menú
 * de la cuenta. La pantalla de elegir solo aparece si hay varias y no hay una última válida.
 */

/** ¿Hay que preguntar a qué empresa entrar? */
export function necesitaElegir(empresas: readonly { id: string }[], ultimaId: string | null): boolean {
  if (empresas.length <= 1) return false;
  return !empresas.some((e) => e.id === ultimaId);
}

/** Ruta a la que va la persona según su rol en la empresa elegida. */
export function destinoDe(empresa: { rol: Rol; areas: readonly Area[] }): string {
  return RUTA_PORTAL[portalDe(empresa.rol, empresa.areas)];
}

/** Texto corto del lugar al que entra: para mostrar junto a cada empresa. */
export function nombreDestino(empresa: { rol: Rol; areas: readonly Area[] }): string {
  return portalDe(empresa.rol, empresa.areas) === 'contable' ? 'Portal contable' : 'Sistema completo';
}

/** "Refrigeración Quispe E.I.R.L." → "RQ". */
export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter((p) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p))
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}
