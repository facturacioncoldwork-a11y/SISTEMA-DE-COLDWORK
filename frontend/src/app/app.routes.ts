import { Route, Routes } from '@angular/router';
import { conSesion } from './core/auth/guards/auth.guards';
import { alPortalCorrecto, conArea, soloAdmin } from './core/permisos/permisos.guards';
import type { Area } from './core/permisos/areas';
import { AUTH_ROUTES } from './modules/auth/auth.routes';
import { CONTABILIDAD_ROUTES } from './modules/contabilidad/contabilidad.routes';
import { PORTAL_TRABAJO_ROUTES } from './modules/contabilidad/portal/portal.routes';
import { EMPRESAS_ROUTES } from './modules/empresas/empresas.routes';
import { EQUIPO_ROUTES } from './modules/equipo/equipo.routes';

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

  // Portales de trabajadores: interfaz propia, sin el menú del ERP
  ...PORTAL_TRABAJO_ROUTES,

  {
    path: '',
    // Quien tiene portal propio (ej. el contador) es llevado a él y no ve el ERP
    canActivate: [conSesion, alPortalCorrecto],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./modules/inicio/views/inicio/inicio').then((m) => m.Inicio) },
      ...EMPRESAS_ROUTES,
      ...EQUIPO_ROUTES,
      ...CONTABILIDAD_ROUTES,

      // Etapa 1 — Contabilidad y finanzas
      enConstruccion('terceros', 'Clientes y proveedores', 'administracion'),
      enConstruccion('caja-bancos', 'Caja y bancos', 'finanzas'),
      enConstruccion('ventas', 'Ventas', 'ventas'),
      enConstruccion('compras', 'Compras', 'logistica'),
      enConstruccion('cuentas-cobrar', 'Cuentas por cobrar', 'finanzas'),
      enConstruccion('cuentas-pagar', 'Cuentas por pagar', 'finanzas'),
      enConstruccion('reportes', 'Reportes', 'contabilidad'),

      // Etapas siguientes
      enConstruccion('servicios', 'Servicios técnicos', 'tecnica'),
      enConstruccion('inventario', 'Inventario', 'logistica'),
      enConstruccion('personal', 'Asistencia y planilla', 'personal'),
      enConstruccion('configuracion', 'Configuración', 'admin'),
    ],
  },
  { path: '**', redirectTo: '' },
];
