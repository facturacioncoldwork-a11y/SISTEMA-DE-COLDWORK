import { Route, Routes } from '@angular/router';
import { conSesion } from './core/auth/guards/auth.guards';
import { alPortalCorrecto, conArea, conEmpresaElegida, soloAdmin } from './core/permisos/permisos.guards';
import type { Area } from './core/permisos/areas';
import { AUTH_ROUTES } from './modules/auth/auth.routes';
import { CONTABILIDAD_ROUTES } from './modules/contabilidad/contabilidad.routes';
import { PORTAL_TRABAJO_ROUTES } from './modules/contabilidad/portal/portal.routes';
import { ELEGIR_EMPRESA_ROUTES, EMPRESAS_ROUTES } from './modules/empresas/empresas.routes';
import { EQUIPO_ROUTES } from './modules/equipo/equipo.routes';
import { FINANZAS_ROUTES } from './modules/finanzas/finanzas.routes';
import { LOGISTICA_ROUTES } from './modules/logistica/logistica.routes';
import { PERSONAL_ROUTES } from './modules/personal/personal.routes';
import { REPORTES_ROUTES } from './modules/reportes/reportes.routes';
import { PROYECTOS_ROUTES } from './modules/servicios/proyectos.routes';
import { SERVICIOS_ROUTES } from './modules/servicios/servicios.routes';

/**
 * Rutas raíz. Cada módulo tiene su propio `<modulo>.routes.ts` y aquí solo se juntan.
 * Todo se carga solo cuando se entra (lazy loading).
 */

/** Módulo aún no construido: muestra "Próximamente", pero ya protegido por área. */
function enConstruccion(path: string, titulo: string, acceso: Area | 'admin'): Route {
  return {
    path,
    canActivate: [acceso === 'admin' ? soloAdmin : conArea(acceso)],
    data: { titulo },
    loadComponent: () => import('./shared/components/proximamente/proximamente').then((m) => m.Proximamente),
  };
}

export const routes: Routes = [
  ...AUTH_ROUTES,

  // Con varias empresas: a cuál entrar
  ...ELEGIR_EMPRESA_ROUTES,

  // Portales de trabajadores: interfaz propia, sin el menú del ERP
  ...PORTAL_TRABAJO_ROUTES,

  // Tablet de la oficina: muestra el código de asistencia sin iniciar sesión (solo con su token)
  { path: 'tableta', loadComponent: () => import('./modules/personal/views/tableta/tableta').then((m) => m.Tableta) },

  {
    path: '',
    // Primero se elige empresa (si tiene varias); quien tiene portal propio va a él y no ve el ERP
    canActivate: [conSesion, conEmpresaElegida, alPortalCorrecto],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./modules/inicio/views/inicio/inicio').then((m) => m.Inicio) },
      ...EMPRESAS_ROUTES,
      ...EQUIPO_ROUTES,
      ...LOGISTICA_ROUTES,
      ...CONTABILIDAD_ROUTES,
      ...FINANZAS_ROUTES,
      ...REPORTES_ROUTES,

      // Operaciones
      ...PROYECTOS_ROUTES,
      ...SERVICIOS_ROUTES,
      ...PERSONAL_ROUTES,

      // Etapas siguientes
      enConstruccion('configuracion', 'Configuración', 'admin'),
    ],
  },
  { path: '**', redirectTo: '' },
];
