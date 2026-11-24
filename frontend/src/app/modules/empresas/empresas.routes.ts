import { Routes } from '@angular/router';
import { conSesion } from '../../core/auth/guards/auth.guards';

/** Pantalla "¿A qué empresa entras?" (fuera del shell: aún no se eligió portal). */
export const ELEGIR_EMPRESA_ROUTES: Routes = [
  {
    path: 'elegir-empresa',
    canActivate: [conSesion],
    loadComponent: () => import('./views/elegir-empresa/elegir-empresa').then((m) => m.ElegirEmpresa),
  },
];

/** Rutas del módulo Empresas (dentro del shell). */
export const EMPRESAS_ROUTES: Routes = [
  {
    path: 'empresa/nueva',
    loadComponent: () => import('./views/crear-empresa/crear-empresa').then((m) => m.CrearEmpresa),
  },
];
