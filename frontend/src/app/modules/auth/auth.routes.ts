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
    // Enlace que recibe el trabajador invitado (abre con o sin sesión)
    path: 'invitacion/:codigo',
    loadComponent: () => import('./views/aceptar-invitacion/aceptar-invitacion').then((m) => m.AceptarInvitacion),
  },
  {
    path: 'registro',
    canActivate: [sinSesion],
    loadComponent: () => import('./views/registro/registro').then((m) => m.Registro),
  },
];
