import type { ActividadEntity, AsientoEntity, ConfigEntity } from '../entities/contabilidad.entity.js';

/** Lo que recibe la pantalla (camelCase, mismos nombres que el modelo del frontend). */

export class AsientoRespuesta {
  static desde(a: AsientoEntity) {
    return {
      id: a.id,
      numero: a.numero,
      periodo: a.periodo,
      fecha: a.fecha,
      origen: a.origen,
      glosa: a.glosa,
      moneda: a.moneda,
      tipoCambio: a.tipo_cambio === null ? undefined : Number(a.tipo_cambio),
      documento: a.documento ?? undefined,
      adjuntos: a.adjuntos ?? [],
      estado: a.estado,
      observacion: a.observacion ?? undefined,
      creadoPor: a.creado_por ?? '',
      creadoPorNombre: a.creado_por_nombre ?? '',
      registradoPor: a.registrado_por ?? undefined,
      creadoEn: a.creado_en,
      lineas: [...(a.lineas ?? [])]
        .sort((x, y) => x.orden - y.orden)
        .map((l) => ({
          cuenta: l.cuenta,
          debe: Number(l.debe),
          haber: Number(l.haber),
          glosa: l.glosa ?? undefined,
        })),
    };
  }
}

export class ActividadRespuesta {
  static desde(a: ActividadEntity) {
    return {
      id: a.id,
      fecha: a.fecha,
      personaId: a.persona_id ?? '',
      personaNombre: a.persona_nombre ?? '',
      accion: a.accion,
      asientoId: a.asiento_id ?? '',
      numero: a.numero ?? 0,
      glosa: a.glosa ?? '',
      detalle: a.detalle ?? undefined,
    };
  }
}

export class ConfigRespuesta {
  static desde(c: ConfigEntity | null) {
    return {
      regimen: c?.regimen ?? 'rmt',
      tramo: c?.tramo ?? 'hasta300',
      contadorRegistraDirecto: c?.contador_registra_directo ?? false,
      contadorVeLibros: c?.contador_ve_libros ?? true,
    };
  }
}
