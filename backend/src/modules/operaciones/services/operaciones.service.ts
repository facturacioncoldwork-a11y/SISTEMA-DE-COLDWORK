import { Injectable } from '@nestjs/common';
import type { EmpresaActual, UsuarioActual } from '../../../common/index.js';
import type { AprobarCotizacionDto, EstadoCotizacionDto, GuardarDocumentoDto, GuardarEquipoDto } from '../dto/operaciones.dto.js';
import { OperacionesRepository, type Fila } from '../repositories/operaciones.repository.js';

/** Hace cuánto se traen los registros cerrados (los abiertos se traen siempre). */
const DIAS_HISTORIA = 365;

const LIMA = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "2026-11-28T15:04:00Z" → "2026-11-28 10:04" (hora de Lima). */
export function fechaHoraLima(iso: string): string {
  const p = Object.fromEntries(LIMA.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p['year']}-${p['month']}-${p['day']} ${p['hour'] === '24' ? '00' : p['hour']}:${p['minute']}`;
}

export function desdeHace(dias: number, hoy = new Date()): string {
  return new Date(hoy.getTime() - dias * 86_400_000).toISOString().slice(0, 10);
}

const obj = (v: unknown): Fila => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Fila) : {});

export function aCotizacion(f: Fila) {
  return {
    ...obj(f['datos']),
    id: f['id'],
    serie: f['serie'],
    numero: f['numero'],
    clienteId: f['cliente_id'] ?? '',
    proyecto: f['proyecto'],
    fecha: f['fecha'],
    validezDias: f['validez_dias'],
    moneda: f['moneda'],
    estado: f['estado'],
    expedienteId: f['expediente_id'] ?? undefined,
    motivoRechazo: f['motivo_rechazo'] ?? undefined,
    version: f['version'],
  };
}

export function aExpediente(f: Fila) {
  return {
    ...obj(f['datos']),
    id: f['id'],
    codigo: f['codigo'],
    clienteId: f['cliente_id'] ?? '',
    titulo: f['titulo'],
    responsableId: f['responsable_id'] ?? '',
    etapa: f['etapa'],
    creado: f['creado'],
    historial: [],
    version: f['version'],
  };
}

export function aOrden(f: Fila) {
  return {
    id: f['id'],
    numero: f['numero'],
    clienteId: f['cliente_id'],
    equipoId: f['equipo_id'],
    expedienteId: f['expediente_id'] ?? undefined,
    tipo: f['tipo'],
    prioridad: f['prioridad'],
    tecnicos: f['tecnicos'] ?? [],
    fecha: f['fecha'],
    hora: typeof f['hora'] === 'string' ? f['hora'].slice(0, 5) : '',
    descripcion: f['descripcion'],
    estado: f['estado'],
    informe: obj(f['informe']),
    mensajes: [],
    version: f['version'],
  };
}

export function aEquipo(f: Fila) {
  return {
    id: f['id'],
    clienteId: f['cliente_id'],
    codigo: f['codigo'],
    tipo: f['tipo'],
    marca: f['marca'],
    modelo: f['modelo'],
    serie: f['serie'],
    refrigerante: f['refrigerante'],
    capacidad: f['capacidad'],
    ubicacion: f['ubicacion'],
  };
}

@Injectable()
export class OperacionesService {
  constructor(private readonly repo: OperacionesRepository) {}

  async directorio(u: UsuarioActual, e: EmpresaActual) {
    const filas = await this.repo.directorio(u.token, e.id);
    return filas.map((f) => ({ usuarioId: f['usuario_id'], nombre: f['nombre'], rol: f['rol'], areas: f['areas'] ?? [], activo: f['activo'] }));
  }

  // ─── Cotizaciones ──────────────────────────────────────────────
  async cotizaciones(u: UsuarioActual, e: EmpresaActual) {
    return (await this.repo.cotizaciones(u.token, e.id, desdeHace(DIAS_HISTORIA))).map(aCotizacion);
  }
  guardarCotizacion(u: UsuarioActual, e: EmpresaActual, id: string, dto: GuardarDocumentoDto) {
    return this.repo.rpc(u.token, 'ope_guardar_cotizacion', { p_empresa: e.id, p_id: id, p_datos: dto.datos, p_version: dto.version });
  }
  async estadoCotizacion(u: UsuarioActual, e: EmpresaActual, id: string, dto: EstadoCotizacionDto) {
    await this.repo.rpc(u.token, 'ope_estado_cotizacion', { p_empresa: e.id, p_id: id, p_estado: dto.estado, p_motivo: dto.motivo ?? null });
  }
  aprobarCotizacion(u: UsuarioActual, e: EmpresaActual, id: string, dto: AprobarCotizacionDto) {
    return this.repo.rpc(u.token, 'ope_aprobar_cotizacion', {
      p_empresa: e.id,
      p_id: id,
      p_orden_cliente: dto.ordenCliente,
      p_expediente_id: dto.expedienteId,
      p_expediente: dto.expediente,
    });
  }

  // ─── Servicios (expedientes) ──────────────────────────────────
  async expedientes(u: UsuarioActual, e: EmpresaActual) {
    return (await this.repo.expedientes(u.token, e.id, desdeHace(DIAS_HISTORIA))).map(aExpediente);
  }
  guardarExpediente(u: UsuarioActual, e: EmpresaActual, id: string, dto: GuardarDocumentoDto) {
    return this.repo.rpc(u.token, 'ope_guardar_expediente', {
      p_empresa: e.id,
      p_id: id,
      p_datos: dto.datos,
      p_version: dto.version,
      p_nota: dto.nota ?? null,
    });
  }
  async historial(u: UsuarioActual, e: EmpresaActual, id: string) {
    const filas = await this.repo.historial(u.token, e.id, id);
    return filas.map((f) => ({ fecha: fechaHoraLima(String(f['creado_en'])), autor: f['autor_nombre'], texto: f['texto'] }));
  }

  // ─── Equipos y órdenes ────────────────────────────────────────
  async equipos(u: UsuarioActual, e: EmpresaActual) {
    return (await this.repo.equipos(u.token, e.id)).map(aEquipo);
  }
  async guardarEquipo(u: UsuarioActual, e: EmpresaActual, id: string, dto: GuardarEquipoDto) {
    await this.repo.rpc(u.token, 'ope_guardar_equipo', { p_empresa: e.id, p_id: id, p_datos: dto.datos });
  }
  async ordenes(u: UsuarioActual, e: EmpresaActual) {
    return (await this.repo.ordenes(u.token, e.id, desdeHace(DIAS_HISTORIA))).map(aOrden);
  }
  guardarOrden(u: UsuarioActual, e: EmpresaActual, id: string, dto: GuardarDocumentoDto) {
    return this.repo.rpc(u.token, 'ope_guardar_orden', { p_empresa: e.id, p_id: id, p_datos: dto.datos, p_version: dto.version });
  }
  async mensajes(u: UsuarioActual, e: EmpresaActual, id: string) {
    const filas = await this.repo.mensajes(u.token, e.id, id);
    return filas.map((f) => ({ autorId: f['autor_id'], autor: f['autor_nombre'], texto: f['texto'], hora: fechaHoraLima(String(f['creado_en'])).slice(11) }));
  }
  enviarMensaje(u: UsuarioActual, e: EmpresaActual, id: string, texto: string) {
    return this.repo.rpc(u.token, 'ope_enviar_mensaje', { p_empresa: e.id, p_orden: id, p_texto: texto });
  }
}
