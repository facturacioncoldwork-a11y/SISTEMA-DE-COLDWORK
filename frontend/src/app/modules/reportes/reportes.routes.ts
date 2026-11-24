import { Routes } from '@angular/router';
import { conArea } from '../../core/permisos/permisos.guards';

/**
 * Reportes financieros (dentro del shell). Se arman con los asientos registrados de
 * Contabilidad y los comprobantes de Finanzas, así siempre coinciden con los libros.
 */
export const REPORTES_ROUTES: Routes = [
  {
    path: 'reportes',
    canActivate: [conArea('contabilidad')],
    loadComponent: () => import('./views/reportes/reportes').then((m) => m.Reportes),
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { titulo: 'Estado de Resultados', sub: 'Ingresos, gastos y utilidad del periodo, desde el Libro Diario.' },
        loadComponent: () => import('./views/resultados/resultados').then((m) => m.Resultados),
      },
      {
        path: 'situacion',
        data: { titulo: 'Estado de Situación Financiera', sub: 'Activo, pasivo y patrimonio a una fecha.' },
        loadComponent: () => import('./views/situacion/situacion').then((m) => m.Situacion),
      },
      {
        path: 'tributario',
        data: { titulo: 'Resumen tributario', sub: 'IGV, pago a cuenta de renta y retenciones del mes (PDT 621).' },
        loadComponent: () => import('./views/tributario/tributario').then((m) => m.Tributario),
      },
    ],
  },
];
