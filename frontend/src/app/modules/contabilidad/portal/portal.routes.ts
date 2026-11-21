import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { conSesion } from '../../../core/auth/guards/auth.guards';
import { conEmpresaElegida, conPortal } from '../../../core/permisos/permisos.guards';
import { ContabilidadService } from '../services/contabilidad.service';

/** SIMULACIÓN: al entrar al portal se actúa como la contadora (luego vendrá de la cuenta real). */
const entrarComoContador = () => {
  inject(ContabilidadService).vista.set('contador');
  return true;
};

/** Libros de la empresa: solo si el dueño se lo permitió al contador. */
const conPermisoLibros = () => inject(ContabilidadService).permisos().verLibros || inject(Router).parseUrl('/trabajo');

/**
 * Portal del contador: interfaz PROPIA, fuera del menú del ERP.
 * No muestra nada del dueño (resumen financiero, aprobaciones, actividad, otros módulos).
 */
export const PORTAL_TRABAJO_ROUTES: Routes = [
  {
    path: 'trabajo',
    canActivate: [conSesion, conEmpresaElegida, conPortal('contable'), entrarComoContador],
    loadComponent: () => import('./portal-layout/portal-layout').then((m) => m.PortalLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('../views/mi-trabajo/mi-trabajo').then((m) => m.MiTrabajo),
      },
      {
        path: 'mis-asientos',
        loadComponent: () => import('./mis-asientos/mis-asientos').then((m) => m.MisAsientos),
      },
      {
        path: 'cierre',
        loadComponent: () => import('./cierre-mes/cierre-mes').then((m) => m.CierreMes),
      },
      {
        path: 'libros-sunat',
        loadComponent: () => import('../views/libros-sunat/libros-sunat').then((m) => m.LibrosSunat),
      },
      {
        path: 'plan-cuentas',
        loadComponent: () => import('../views/plan-cuentas/plan-cuentas').then((m) => m.PlanCuentas),
      },
      {
        path: 'diario',
        canActivate: [conPermisoLibros],
        loadComponent: () => import('../views/libro-diario/libro-diario').then((m) => m.LibroDiario),
      },
      {
        path: 'mayor',
        canActivate: [conPermisoLibros],
        loadComponent: () => import('../views/libro-mayor/libro-mayor').then((m) => m.LibroMayor),
      },
      {
        path: 'balance',
        canActivate: [conPermisoLibros],
        loadComponent: () => import('../views/balance/balance').then((m) => m.Balance),
      },
    ],
  },
];
