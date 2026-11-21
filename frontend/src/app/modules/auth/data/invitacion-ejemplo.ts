import type { Area, Rol } from '../../../core/permisos/areas';

/** Lo que muestra la pantalla de invitación (luego vendrá del servidor con el código). */
export interface InvitacionPublica {
  empresa: string;
  invitadoPor: string;
  correo: string;
  nombre: string;
  rol: Rol;
  areas: Area[];
  /** Fecha límite (AAAA-MM-DD): la invitación vence a los 7 días. */
  vence: string;
}

/**
 * SIMULACIÓN: invitación de ejemplo, enlace /invitacion/demo.
 * En la app real el código será aleatorio, de un solo uso y con vencimiento.
 */
export const INVITACION_DEMO: InvitacionPublica = {
  empresa: 'COLDWORK',
  invitadoPor: 'El dueño de COLDWORK',
  correo: 'maria.quispe@ejemplo.com',
  nombre: 'María Quispe',
  rol: 'contador',
  areas: ['contabilidad'],
  vence: '2026-11-28',
};
