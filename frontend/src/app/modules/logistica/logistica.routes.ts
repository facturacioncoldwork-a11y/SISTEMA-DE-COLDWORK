import { Routes } from '@angular/router';
import { conArea, soloDueno } from '../../core/permisos/permisos.guards';

/**
 * Rutas del módulo Almacén y logística (dentro del shell). Área: logística.
 * `logistica` es el contenedor (cabecera + navegación) y cada pestaña es una vista hija.
 */
export const LOGISTICA_ROUTES: Routes = [
  {
    path: 'logistica',
    canActivate: [conArea('logistica')],
    loadComponent: () => import('./views/logistica/logistica').then((m) => m.Logistica),
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: {
          titulo: 'Panel de almacén',
          sub: 'Cómo está tu inventario hoy: valor, alertas de reposición y movimiento.',
        },
        loadComponent: () => import('./views/panel/panel').then((m) => m.Panel),
      },
      {
        path: 'inventario',
        data: {
          titulo: 'Inventario',
          sub: 'Stock por producto y almacén. Toca un producto para ver su kardex.',
        },
        loadComponent: () => import('./views/inventario/inventario').then((m) => m.Inventario),
      },
      {
        path: 'llegadas',
        data: {
          titulo: 'Llegada de producto',
          sub: 'Registra lo que entra al almacén, con o sin orden de compra.',
        },
        loadComponent: () => import('./views/llegadas/llegadas').then((m) => m.Llegadas),
      },
      {
        path: 'salidas',
        data: {
          titulo: 'Salida de producto',
          sub: 'Despachos a servicios técnicos, ventas, consumo, mermas y transferencias.',
        },
        loadComponent: () => import('./views/salidas/salidas').then((m) => m.Salidas),
      },
      {
        path: 'ordenes-compra',
        data: {
          titulo: 'Órdenes de compra',
          sub: 'Desde el borrador hasta que el último producto llega al almacén.',
        },
        loadComponent: () =>
          import('./views/ordenes-compra/ordenes-compra').then((m) => m.OrdenesCompra),
      },
      {
        path: 'proveedores',
        data: {
          titulo: 'Proveedores',
          sub: 'A quién le compras, condiciones de crédito y calificación.',
        },
        loadComponent: () => import('./views/proveedores/proveedores').then((m) => m.Proveedores),
      },
      {
        path: 'almacenes',
        data: {
          titulo: 'Almacenes',
          sub: 'Almacén principal, unidades móviles de técnicos y obras.',
        },
        loadComponent: () => import('./views/almacenes/almacenes').then((m) => m.Almacenes),
      },
      {
        path: 'asistencia',
        canActivate: [soloDueno],
        data: {
          titulo: 'Asistencia del equipo',
          sub: 'Quién llegó, tardanzas y faltas del personal de almacén. Lo supervisa el CEO.',
        },
        loadComponent: () =>
          import('./views/asistencia/asistencia').then((m) => m.AsistenciaLogistica),
      },
    ],
  },
  // Rutas antiguas del menú → al módulo nuevo
  { path: 'inventario', redirectTo: 'logistica/inventario' },
];
