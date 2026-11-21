import { Routes } from '@angular/router';
import { soloDueno } from '../../core/permisos/permisos.guards';

/** Rutas del módulo Equipo (dentro del shell). Solo el dueño (CEO) da accesos. */
export const EQUIPO_ROUTES: Routes = [
  {
    path: 'equipo',
    canActivate: [soloDueno],
    loadComponent: () => import('./views/equipo/equipo').then((m) => m.Equipo),
  },
];
