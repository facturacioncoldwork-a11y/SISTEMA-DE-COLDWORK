import { veTodo, type Area, type Rol } from './areas';

/**
 * A qué interfaz (portal) entra cada persona después de iniciar sesión.
 * Todos usan el MISMO login; la app los lleva a su portal según su rol y áreas.
 *
 *  - erp:      dueño y admin → ERP completo (menú lateral, todos los módulos).
 *  - contable: contador, o trabajador solo de contabilidad/finanzas → /trabajo.
 *
 * Más adelante se agregan los portales de técnicos, logística, etc.
 * Mientras un área no tenga portal propio, esa persona usa el ERP filtrado por sus áreas.
 */
export type Portal = 'erp' | 'contable';

export const RUTA_PORTAL: Record<Portal, string> = {
  erp: '/',
  contable: '/trabajo',
};

const AREAS_CONTABLES: readonly Area[] = ['contabilidad', 'finanzas'];

export function portalDe(rol: Rol | null | undefined, areas: readonly Area[] = []): Portal {
  if (!rol || veTodo(rol)) return 'erp';
  if (rol === 'contador') return 'contable';
  const soloContable = areas.length > 0 && areas.every((a) => AREAS_CONTABLES.includes(a));
  return soloContable ? 'contable' : 'erp';
}
