import type { Asiento, ConfigAprobacion, Permisos, Persona } from '../models/contabilidad.model';

/**
 * Qué puede hacer cada persona en Contabilidad.
 * Funciones puras (probadas en permisos.spec.ts); el backend aplicará las mismas reglas.
 */

export function permisosDe(persona: Persona, config: ConfigAprobacion): Permisos {
  const esDueno = persona.rol === 'dueno';
  return {
    registrar: esDueno || config.contadorRegistraDirecto,
    aprobar: esDueno,
    anular: esDueno,
    configurar: esDueno,
    verActividad: esDueno,
    verLibros: esDueno || config.contadorVeLibros,
  };
}

/** Se puede editar mientras no esté registrado ni anulado (y lo edita su autor o el dueño). */
export function puedeEditar(asiento: Asiento, persona: Persona): boolean {
  const abierto = asiento.estado === 'borrador' || asiento.estado === 'observado';
  return abierto && (persona.rol === 'dueno' || asiento.creadoPor === persona.id);
}

/** Estados que el contador ve como "su trabajo pendiente". */
export function pendientesDe(asientos: Asiento[], persona: Persona) {
  const mios = asientos.filter((a) => a.creadoPor === persona.id);
  return {
    observados: mios.filter((a) => a.estado === 'observado'),
    borradores: mios.filter((a) => a.estado === 'borrador'),
    enRevision: mios.filter((a) => a.estado === 'por_aprobar'),
  };
}
