import { Routes } from '@angular/router';
import { sinSesion } from '../../core/auth/guards/auth.guards';

/** Rutas públicas del módulo Auth (solo sin sesión). */
export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    canActivate: [sinSesion],
    loadComponent: () => import('./views/login/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    canActivate: [sinSesion],
    loadComponent: () => import('./views/registro/registro').then((m) => m.Registro),
  },
];
