import { Routes } from '@angular/router';
import { conArea } from '../../core/permisos/permisos.guards';

/**
 * Servicios y proyectos (coordinación comercial y operativa): cotizaciones, órdenes de los
 * clientes y cada servicio de principio a fin. Es del coordinador/ingeniero y del dueño;
 * los técnicos usan el Área técnica (/servicios) y no ven precios.
 */
export const PROYECTOS_ROUTES: Routes = [
  {
    path: 'proyectos',
    canActivate: [conArea('ventas')],
    loadComponent: () => import('./views/proyectos/proyectos').then((m) => m.Proyectos),
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { titulo: 'Panel de coordinación', sub: 'Qué espera al cliente, qué espera materiales y qué falta facturar o cobrar.' },
        loadComponent: () => import('./views/expedientes/expedientes').then((m) => m.Expedientes),
      },
      {
        path: 'cotizaciones',
        data: { titulo: 'Cotizaciones', sub: 'Propuestas para tus clientes, con su forma de pago y su PDF formal.' },
        loadComponent: () => import('./views/cotizaciones/cotizaciones').then((m) => m.Cotizaciones),
      },
      {
        path: 'cotizaciones/:id',
        data: { titulo: 'Cotización', sub: 'Secciones, precios, IGV y adelantos. Los costos internos no salen en el PDF.' },
        loadComponent: () => import('./views/cotizacion/cotizacion').then((m) => m.CotizacionView),
      },
      {
        path: 'servicios/:id',
        data: { titulo: 'Servicio en curso', sub: 'Qué falta, quién lo hace, los pagos y todo lo que pasó, en un solo lugar.' },
        loadComponent: () => import('./views/expediente/expediente').then((m) => m.ExpedienteView),
      },
    ],
  },
];
