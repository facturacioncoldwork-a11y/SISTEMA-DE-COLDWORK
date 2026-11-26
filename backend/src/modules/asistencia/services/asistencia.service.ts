import { BadRequestException, Injectable } from '@nestjs/common';
import { Area, Rol, type EmpresaActual, type UsuarioActual } from '../../../common/index.js';
import { FECHA } from '../../finanzas/services/finanzas.service.js';
import type { AusenciaDto, HorarioDto, MarcaManualDto, MarcarDto } from '../dto/asistencia.dto.js';
import { AsistenciaRepository } from '../repositories/asistencia.repository.js';

type Fila = Record<string, unknown>;

const txt = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '');
const hhmm = (v: unknown) => (typeof v === 'string' ? v.slice(0, 5) : undefined);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Horario por defecto mientras la empresa no guarde el suyo (Perú: 8 h + refrigerio). */
export const HORARIO_POR_DEFECTO = {
  entrada: '08:00',
  salida: '17:00',
  refrigerio: 60,
  refrigerioDesde: '12:00',
  refrigerioHasta: '15:00',
  tolerancia: 10,
  metodos: ['gps', 'codigo', 'manual'],
  selfie: false,
  oficinaLat: null as number | null,
  oficinaLng: null as number | null,
  radioOficina: 150,
};

/** ¿Gestiona la asistencia? (dueño, admin o área Personal). */
export function esGestor(e: Pick<EmpresaActual, 'rol' | 'areas'>): boolean {
  return e.rol === Rol.Dueno || e.rol === Rol.Admin || e.areas.includes(Area.Personal);
}

/** Rango máximo de consulta: 93 días (un trimestre), para que la consulta siempre sea rápida. */
export function validarRango(desde: string, hasta: string): void {
  if (!FECHA.test(desde) || !FECHA.test(hasta)) throw new BadRequestException('Fecha inválida');
  if (desde > hasta) throw new BadRequestException('La fecha inicial es mayor que la final');
  if ((Date.parse(hasta) - Date.parse(desde)) / 86_400_000 > 93) throw new BadRequestException('Consulta como máximo 3 meses a la vez');
}

@Injectable()
export class AsistenciaService {
  constructor(private readonly repo: AsistenciaRepository) {}

  async horario(u: UsuarioActual, e: EmpresaActual) {
    const f = await this.repo.horario(u.token, e.id);
    const h = f
      ? {
          entrada: hhmm(f['entrada'])!,
          salida: hhmm(f['salida'])!,
          refrigerio: Number(f['refrigerio_min']),
          refrigerioDesde: hhmm(f['refrigerio_desde'])!,
          refrigerioHasta: hhmm(f['refrigerio_hasta'])!,
          tolerancia: Number(f['tolerancia_min']),
          metodos: (f['metodos'] as string[]) ?? [],
          selfie: Boolean(f['pedir_selfie']),
          oficinaLat: num(f['oficina_lat']),
          oficinaLng: num(f['oficina_lng']),
          radioOficina: Number(f['radio_oficina_m']),
        }
      : HORARIO_POR_DEFECTO;
    return { ...h, esGestor: esGestor(e) };
  }

  guardarHorario(u: UsuarioActual, e: EmpresaActual, dto: HorarioDto) {
    if ((dto.oficinaLat === null || dto.oficinaLat === undefined) !== (dto.oficinaLng === null || dto.oficinaLng === undefined)) {
      throw new BadRequestException('La ubicación de la oficina necesita latitud y longitud');
    }
    return this.repo.guardarHorario(u.token, e.id, dto);
  }

  async marcas(u: UsuarioActual, e: EmpresaActual, desde: string, hasta: string) {
    validarRango(desde, hasta);
    const [marcas, ausencias] = await Promise.all([
      this.repo.marcas(u.token, e.id, desde, hasta),
      this.repo.ausencias(u.token, e.id, desde, hasta),
    ]);
    return { marcas: marcas.map(aMarca), ausencias: ausencias.map(aAusencia) };
  }

  async marcar(u: UsuarioActual, e: EmpresaActual, dto: MarcarDto) {
    if (dto.metodo === 'gps' && (dto.lat === undefined || dto.lng === undefined)) throw new BadRequestException('No se recibió tu ubicación');
    if (dto.metodo === 'codigo' && !dto.codigo) throw new BadRequestException('Escribe el código de la tablet');
    if (dto.metodo === 'declarada' && (!dto.hora || !dto.motivo || dto.motivo.length < 5)) {
      throw new BadRequestException('Indica la hora y qué pasó');
    }
    const r = await this.repo.marcar(u.token, e.id, dto);
    return { accion: txt(r['accion']), hora: txt(r['hora']), lugar: txt(r['lugar']), pendiente: Boolean(r['pendiente']) };
  }

  async marcarManual(u: UsuarioActual, e: EmpresaActual, dto: MarcaManualDto) {
    const r = await this.repo.marcarManual(u.token, e.id, dto.usuarioId, dto.motivo);
    return { accion: txt(r['accion']), hora: txt(r['hora']) };
  }

  aprobar(u: UsuarioActual, e: EmpresaActual, id: string) {
    return this.repo.aprobar(u.token, e.id, id);
  }

  async codigoOficina(u: UsuarioActual, e: EmpresaActual) {
    const r = await this.repo.codigoOficina(u.token, e.id);
    return { codigo: txt(r['codigo']), segundos: Number(r['segundos']) };
  }

  registrarAusencia(u: UsuarioActual, e: EmpresaActual, dto: AusenciaDto) {
    if (!FECHA.test(dto.fecha)) throw new BadRequestException('Fecha inválida');
    return this.repo.registrarAusencia(u.token, e.id, dto);
  }
}

export function aMarca(f: Fila) {
  return {
    id: txt(f['id']),
    trabajadorId: txt(f['usuario_id']),
    fecha: txt(f['fecha']),
    entrada: hhmm(f['entrada']),
    salida: hhmm(f['salida']),
    metodo: txt(f['metodo']),
    metodoSalida: f['metodo_salida'] ? txt(f['metodo_salida']) : undefined,
    lugar: txt(f['lugar']),
    lugarSalida: f['lugar_salida'] ? txt(f['lugar_salida']) : undefined,
    salidaEnCampo: Boolean(f['salida_en_campo']),
    motivo: f['motivo'] ? txt(f['motivo']) : undefined,
    pendiente: Boolean(f['pendiente']),
  };
}

function aAusencia(f: Fila) {
  return { id: txt(f['id']), trabajadorId: txt(f['usuario_id']), fecha: txt(f['fecha']), tipo: txt(f['tipo']) };
}
