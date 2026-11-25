import { Routes } from '@angular/router';
import { conArea } from '../../core/permisos/permisos.guards';

/** Personal: asistencia (marcas, registro mensual) y horario de la empresa. */
export const PERSONAL_ROUTES: Routes = [
  {
    path: 'personal',
    canActivate: [conArea('personal')],
    loadComponent: () => import('./views/personal/personal').then((m) => m.Personal),
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { titulo: 'Asistencia de hoy', sub: 'Quién llegó, quién está en campo y quién falta, al instante.' },
        loadComponent: () => import('./views/hoy/hoy').then((m) => m.AsistenciaHoy),
      },
      {
        path: 'marcar',
        data: { titulo: 'Marcar asistencia', sub: 'Así marca cada trabajador su entrada y salida.' },
        loadComponent: () => import('./views/marcar/marcar').then((m) => m.Marcar),
      },
      {
        path: 'registro',
        data: { titulo: 'Registro de asistencia', sub: 'Horas, tardanzas y horas extra del mes: base de la planilla.' },
        loadComponent: () => import('./views/registro/registro').then((m) => m.Registro),
      },
      {
        path: 'horario',
        data: { titulo: 'Horario y formas de marcar', sub: 'Jornada, refrigerio, tolerancia y cómo se valida cada marca.' },
        loadComponent: () => import('./views/horario/horario').then((m) => m.HorarioView),
      },
    ],
  },
];
