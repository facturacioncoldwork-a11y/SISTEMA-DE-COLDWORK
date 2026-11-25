import { Routes } from '@angular/router';
import { conArea } from '../../core/permisos/permisos.guards';

/** Servicios técnicos (área técnica): órdenes de trabajo, informes de campo y equipos de clientes. */
export const SERVICIOS_ROUTES: Routes = [
  {
    path: 'servicios',
    canActivate: [conArea('tecnica')],
    loadComponent: () => import('./views/servicios/servicios').then((m) => m.Servicios),
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { titulo: 'Tablero de servicios', sub: 'Órdenes de trabajo del día, quién las atiende y en qué van.' },
        loadComponent: () => import('./views/tablero/tablero').then((m) => m.Tablero),
      },
      {
        path: 'ordenes/:id',
        data: { titulo: 'Informe técnico', sub: 'Lo que el técnico encontró e hizo en campo, con fotos y firma del cliente.' },
        loadComponent: () => import('./views/informe/informe').then((m) => m.InformeTecnico),
      },
      {
        path: 'equipos',
        data: { titulo: 'Equipos de clientes', sub: 'Hoja de vida de cada equipo: todos sus servicios e informes.' },
        loadComponent: () => import('./views/equipos/equipos').then((m) => m.Equipos),
      },
    ],
  },
];
