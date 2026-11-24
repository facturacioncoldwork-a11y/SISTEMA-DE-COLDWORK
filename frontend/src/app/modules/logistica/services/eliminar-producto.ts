import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type { Producto } from '../models/logistica.model';
import { usarConfirmacion } from './confirmar';
import { LogisticaStore } from './logistica-store.service';
import { ProductosService } from './productos.service';

export type ResultadoEliminar = 'eliminado' | 'archivado' | null;

/**
 * Eliminar un producto desde cualquier pantalla.
 *  · Sin historial → se borra de la base de datos.
 *  · Con llegadas, salidas u órdenes → borrarlo rompería el kardex y los reportes,
 *    así que ofrece quitarlo de la lista (queda archivado; se ve con "Ver inactivos").
 * Uso (en el constructor o como campo):  private readonly eliminarProducto = usarEliminarProducto();
 */
export function usarEliminarProducto() {
  const api = inject(ProductosService);
  const store = inject(LogisticaStore);
  const confirmar = usarConfirmacion();

  return async (p: Producto): Promise<ResultadoEliminar> => {
    const quedan = p.stockTotal > 0 ? ` Todavía hay ${p.stockTotal} ${p.unidad} en almacén.` : '';
    if (
      !(await confirmar(
        `¿Eliminar ${p.nombre}?`,
        `Se borra de la base de datos y no se puede deshacer.${quedan}`,
      ))
    )
      return null;
    try {
      await api.eliminar(p.id);
      await store.recargar();
      store.ok('Producto eliminado', p.nombre);
      return 'eliminado';
    } catch (e) {
      if (!(e instanceof HttpErrorResponse && e.status === 409)) {
        store.error('No se pudo eliminar', e);
        return null;
      }
    }

    // Tiene historial: no se borra, se quita de la lista
    if (!p.activo) {
      store.error(
        'No se puede borrar',
        new Error(
          `${p.nombre} tiene movimientos en el kardex. Ya está fuera de la lista (archivado).`,
        ),
      );
      return null;
    }
    const conStock =
      p.stockTotal > 0
        ? ` Ojo: todavía hay ${p.stockTotal} ${p.unidad}; si ya no existen, registra antes una salida (merma o venta).`
        : '';
    if (
      !(await confirmar(
        'No se puede borrar: tiene historial',
        `${p.nombre} tiene llegadas, salidas u órdenes de compra. Borrarlo dañaría el kardex y los reportes. ` +
          `Puedes quitarlo de la lista: queda archivado y lo ves con "Ver inactivos".${conStock}`,
        'Quitar de la lista',
      ))
    )
      return null;
    try {
      await api.actualizar(p.id, { activo: false });
      await store.recargar();
      store.ok('Producto quitado de la lista', `${p.nombre} quedó archivado`);
      return 'archivado';
    } catch (e) {
      store.error('No se pudo quitar de la lista', e);
      return null;
    }
  };
}
