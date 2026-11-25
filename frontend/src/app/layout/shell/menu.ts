import type { Area } from '../../core/permisos/areas';

export interface ItemMenu {
  etiqueta: string;
  icono: string;
  ruta: string;
  /** Área necesaria para verlo. Sin área: lo ve todo miembro. */
  area?: Area;
  /** Solo dueño y admin. */
  soloAdmin?: boolean;
  /** Solo el dueño (CEO). */
  soloDueno?: boolean;
  /** Activo solo con la ruta exacta (no con sus hijas). */
  exacta?: boolean;
}
export interface GrupoMenu {
  titulo: string;
  items: ItemMenu[];
}

/**
 * Menú lateral. Cada persona solo ve lo de sus áreas (dueño y admin ven todo).
 * Al agregar un módulo nuevo: añádelo aquí con su área y su ruta en el *.routes.ts del módulo.
 */
export const MENU: GrupoMenu[] = [
  {
    titulo: 'General',
    items: [{ etiqueta: 'Inicio', icono: 'pi pi-home', ruta: '/' }],
  },
  {
    titulo: 'Finanzas',
    items: [
      { etiqueta: 'Panel de finanzas', icono: 'pi pi-th-large', ruta: '/finanzas', area: 'finanzas', exacta: true },
      { etiqueta: 'Clientes y proveedores', icono: 'pi pi-users', ruta: '/finanzas/terceros', area: 'administracion' },
      { etiqueta: 'Caja y bancos', icono: 'pi pi-wallet', ruta: '/finanzas/caja-bancos', area: 'finanzas' },
      { etiqueta: 'Ventas', icono: 'pi pi-arrow-up-right', ruta: '/finanzas/ventas', area: 'ventas' },
      { etiqueta: 'Compras', icono: 'pi pi-arrow-down-left', ruta: '/finanzas/compras', area: 'contabilidad' },
      { etiqueta: 'Cuentas por cobrar', icono: 'pi pi-inbox', ruta: '/finanzas/cuentas-cobrar', area: 'finanzas' },
      { etiqueta: 'Cuentas por pagar', icono: 'pi pi-send', ruta: '/finanzas/cuentas-pagar', area: 'finanzas' },
    ],
  },
  {
    titulo: 'Contabilidad',
    items: [
      { etiqueta: 'Asientos y libros', icono: 'pi pi-book', ruta: '/contabilidad', area: 'contabilidad' },
      { etiqueta: 'Reportes', icono: 'pi pi-chart-bar', ruta: '/reportes', area: 'contabilidad' },
    ],
  },
  {
    titulo: 'Almacén y logística',
    items: [
      { etiqueta: 'Panel de almacén', icono: 'pi pi-th-large', ruta: '/logistica', area: 'logistica', exacta: true },
      { etiqueta: 'Inventario', icono: 'pi pi-box', ruta: '/logistica/inventario', area: 'logistica' },
      { etiqueta: 'Llegadas', icono: 'pi pi-download', ruta: '/logistica/llegadas', area: 'logistica' },
      { etiqueta: 'Salidas', icono: 'pi pi-upload', ruta: '/logistica/salidas', area: 'logistica' },
      { etiqueta: 'Órdenes de compra', icono: 'pi pi-file-edit', ruta: '/logistica/ordenes-compra', area: 'logistica' },
      { etiqueta: 'Proveedores', icono: 'pi pi-truck', ruta: '/logistica/proveedores', area: 'logistica' },
      { etiqueta: 'Almacenes', icono: 'pi pi-warehouse', ruta: '/logistica/almacenes', area: 'logistica' },
    ],
  },
  {
    titulo: 'Servicios y proyectos',
    items: [
      { etiqueta: 'Panel de coordinación', icono: 'pi pi-briefcase', ruta: '/proyectos', area: 'ventas', exacta: true },
      { etiqueta: 'Cotizaciones', icono: 'pi pi-file-edit', ruta: '/proyectos/cotizaciones', area: 'ventas' },
    ],
  },
  {
    titulo: 'Operaciones',
    items: [
      { etiqueta: 'Área técnica', icono: 'pi pi-wrench', ruta: '/servicios', area: 'tecnica' },
      { etiqueta: 'Asistencia', icono: 'pi pi-id-card', ruta: '/personal', area: 'personal' },
    ],
  },
  {
    titulo: 'Sistema',
    items: [
      { etiqueta: 'Equipo y accesos', icono: 'pi pi-users', ruta: '/equipo', soloDueno: true },
      { etiqueta: 'Configuración', icono: 'pi pi-cog', ruta: '/configuracion', soloAdmin: true },
    ],
  },
];
