import { Routes } from '@angular/router';
import { conArea } from '../../core/permisos/permisos.guards';

/** Rutas del módulo Contabilidad (dentro del shell). Área: contabilidad. */
export const CONTABILIDAD_ROUTES: Routes = [
  {
    path: 'contabilidad',
    canActivate: [conArea('contabilidad')],
    loadComponent: () => import('./views/contabilidad-layout/contabilidad-layout').then((m) => m.ContabilidadLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./views/resumen/resumen').then((m) => m.Resumen),
      },
      {
        path: 'diario',
        loadComponent: () => import('./views/libro-diario/libro-diario').then((m) => m.LibroDiario),
      },
      {
        path: 'mayor',
        loadComponent: () => import('./views/libro-mayor/libro-mayor').then((m) => m.LibroMayor),
      },
      {
        path: 'balance',
        loadComponent: () => import('./views/balance/balance').then((m) => m.Balance),
      },
      {
        path: 'plan-cuentas',
        loadComponent: () => import('./views/plan-cuentas/plan-cuentas').then((m) => m.PlanCuentas),
      },
      {
        path: 'libros-sunat',
        loadComponent: () => import('./views/libros-sunat/libros-sunat').then((m) => m.LibrosSunat),
      },
    ],
  },
];
