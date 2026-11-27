import type { OrdenCompra } from './logistica.model';

/**
 * Proyecto de una orden de compra: elegido de Operaciones o con el código escrito a mano
 * (cuando el proyecto no está en la lista, p. ej. el código que viene en la OC o la cotización).
 */
export interface EleccionProyecto {
  manual: boolean;
  id: string | null;
  codigo: string;
  nombre: string;
}

/** Cómo arranca el formulario según el proyecto que ya tiene la OC. */
export function eleccionDe(o: Pick<OrdenCompra, 'proyecto'> | null | undefined): EleccionProyecto {
  const p = o?.proyecto;
  if (p && !p.id)
    return {
      manual: true,
      id: null,
      codigo: p.codigo,
      nombre: p.nombre === p.codigo ? '' : p.nombre,
    };
  return { manual: false, id: p?.id ?? null, codigo: '', nombre: '' };
}

/**
 * Lo que se manda a la API. `editando`: al editar se envía siempre (para poder quitarlo);
 * al crear, solo si se eligió o escribió algo.
 */
export function datosProyecto(
  e: EleccionProyecto,
  editando: boolean,
): { proyectoId?: string | null; proyectoCodigo?: string; proyectoNombre?: string } {
  if (e.manual) {
    const codigo = e.codigo.trim();
    if (!codigo) return editando ? { proyectoId: null } : {};
    return { proyectoCodigo: codigo, proyectoNombre: e.nombre.trim() };
  }
  return editando || e.id ? { proyectoId: e.id } : {};
}

/** Busca un código de proyecto conocido escrito en la OC (notas, cliente, cotización…). */
export function codigoEnTexto(
  o: Pick<OrdenCompra, 'notas' | 'cliente' | 'cotizacionRef' | 'plazoTexto'>,
  codigos: readonly string[],
): string | null {
  const t = [o.notas, o.cliente, o.cotizacionRef, o.plazoTexto].join(' ').toUpperCase();
  if (!t.trim()) return null;
  return codigos.find((c) => c && t.includes(c.toUpperCase())) ?? null;
}
