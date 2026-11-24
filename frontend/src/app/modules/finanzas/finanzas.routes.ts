import { Routes } from '@angular/router';
import { conArea } from '../../core/permisos/permisos.guards';

/**
 * Rutas del módulo Finanzas (dentro del shell).
 * `finanzas` es el contenedor (cabecera + pestañas) y cada pestaña es una vista hija con su área.
 */
export const FINANZAS_ROUTES: Routes = [
  {
    path: 'finanzas',
    loadComponent: () => import('./views/finanzas/finanzas').then((m) => m.Finanzas),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [conArea('finanzas')],
        data: { titulo: 'Panel de finanzas', sub: 'Dinero disponible, lo que te deben y lo que debes, en un vistazo.' },
        loadComponent: () => import('./views/panel/panel').then((m) => m.PanelFinanzas),
      },
      {
        path: 'terceros',
        data: { titulo: 'Clientes y proveedores', sub: 'Con quién trabajas: RUC validado, crédito y contacto.' },
        loadComponent: () => import('./views/terceros/terceros').then((m) => m.Terceros),
      },
      {
        path: 'ventas',
        canActivate: [conArea('ventas')],
        data: {
          titulo: 'Ventas',
          sub: 'Facturas, boletas y notas emitidas. Cada una genera su asiento y su cuenta por cobrar.',
          operacion: 'venta',
        },
        loadComponent: () => import('./views/comprobantes/comprobantes').then((m) => m.Comprobantes),
      },
      {
        path: 'compras',
        canActivate: [conArea('contabilidad')],
        data: {
          titulo: 'Compras',
          sub: 'Comprobantes de tus proveedores. IGV como crédito fiscal, asiento y cuenta por pagar.',
          operacion: 'compra',
        },
        loadComponent: () => import('./views/comprobantes/comprobantes').then((m) => m.Comprobantes),
      },
      {
        path: 'caja-bancos',
        canActivate: [conArea('finanzas')],
        data: { titulo: 'Caja y bancos', sub: 'Cuentas, saldos y cada cobro, pago o transferencia.' },
        loadComponent: () => import('./views/caja-bancos/caja-bancos').then((m) => m.CajaBancos),
      },
      {
        path: 'cuentas-cobrar',
        canActivate: [conArea('finanzas')],
        data: { titulo: 'Cuentas por cobrar', sub: 'Lo que te deben tus clientes, por antigüedad.', operacion: 'venta' },
        loadComponent: () => import('./views/pendientes/pendientes').then((m) => m.Pendientes),
      },
      {
        path: 'cuentas-pagar',
        canActivate: [conArea('finanzas')],
        data: { titulo: 'Cuentas por pagar', sub: 'Lo que debes a tus proveedores, por vencimiento.', operacion: 'compra' },
        loadComponent: () => import('./views/pendientes/pendientes').then((m) => m.Pendientes),
      },
    ],
  },
  // Rutas del menú antiguo → al módulo nuevo
  { path: 'terceros', redirectTo: 'finanzas/terceros' },
  { path: 'ventas', redirectTo: 'finanzas/ventas' },
  { path: 'compras', redirectTo: 'finanzas/compras' },
  { path: 'caja-bancos', redirectTo: 'finanzas/caja-bancos' },
  { path: 'cuentas-cobrar', redirectTo: 'finanzas/cuentas-cobrar' },
  { path: 'cuentas-pagar', redirectTo: 'finanzas/cuentas-pagar' },
];
