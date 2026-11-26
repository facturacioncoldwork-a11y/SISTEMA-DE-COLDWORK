import { Routes } from '@angular/router';
import { conArea } from '../../core/permisos/permisos.guards';

/**
 * Personal: asistencia (marcas, registro mensual) y horario de la empresa.
 * "Marcar" es para todo miembro (cada uno marca lo suyo); el resto solo para quien gestiona Personal.
 * La base de datos aplica las mismas reglas (RLS), así que esto solo ordena la pantalla.
 */
export const PERSONAL_ROUTES: Routes = [
  {
    path: 'personal',
    loadComponent: () => import('./views/personal/personal').then((m) => m.Personal),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [conArea('personal')],
        data: { titulo: 'Asistencia de hoy', sub: 'Quién llegó, quién está en campo y quién falta, al instante.' },
        loadComponent: () => import('./views/hoy/hoy').then((m) => m.AsistenciaHoy),
      },
      {
        path: 'marcar',
        data: { titulo: 'Marcar asistencia', sub: 'Registra tu entrada y salida. La hora la pone el sistema.' },
        loadComponent: () => import('./views/marcar/marcar').then((m) => m.Marcar),
      },
      {
        path: 'registro',
        canActivate: [conArea('personal')],
        data: { titulo: 'Registro de asistencia', sub: 'Horas, tardanzas y horas extra del mes: base de la planilla.' },
        loadComponent: () => import('./views/registro/registro').then((m) => m.Registro),
      },
      {
        path: 'horario',
        canActivate: [conArea('personal')],
        data: { titulo: 'Horario y formas de marcar', sub: 'Jornada, refrigerio, tolerancia y cómo se valida cada marca.' },
        loadComponent: () => import('./views/horario/horario').then((m) => m.HorarioView),
      },
    ],
  },
];
