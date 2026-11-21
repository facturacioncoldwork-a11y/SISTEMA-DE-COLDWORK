import { BadRequestException, Injectable } from '@nestjs/common';
import type { EmpresaActual, UsuarioActual } from '../../../common/index.js';
import {
  ActualizarLlegadaDto,
  ActualizarSalidaDto,
  CrearLlegadaDto,
  CrearSalidaDto,
  LlegadaDto,
  SalidaDto,
} from '../dto/index.js';
import { MovimientosRepository } from '../repositories/index.js';

/**
 * Llegada y salida de producto. La regla dura (stock no negativo, costo
 * promedio, kardex, avance de la OC) vive en SQL y es atómica; aquí se
 * valida la forma y se devuelve el documento completo.
 */
@Injectable()
export class MovimientosService {
  constructor(private readonly repo: MovimientosRepository) {}

  async listarLlegadas(
    u: UsuarioActual,
    e: EmpresaActual,
  ): Promise<LlegadaDto[]> {
    return (await this.repo.listarLlegadas(u.token, e.id)).map((f) =>
      LlegadaDto.desde(f),
    );
  }

  async registrarLlegada(
    u: UsuarioActual,
    e: EmpresaActual,
    dto: CrearLlegadaDto,
  ): Promise<LlegadaDto> {
    sinRepetidos(dto.items);
    const id = await this.repo.registrarLlegada(u.token, e.id, dto);
    return LlegadaDto.desde(await this.repo.obtenerLlegada(u.token, e.id, id));
  }

  async actualizarLlegada(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
    dto: ActualizarLlegadaDto,
  ): Promise<LlegadaDto> {
    const c: Record<string, unknown> = {};
    if (dto.guiaRemision !== undefined)
      c['guia_remision'] = dto.guiaRemision.trim() || null;
    if (dto.comprobante !== undefined)
      c['comprobante'] = dto.comprobante.trim() || null;
    if (dto.notas !== undefined) c['notas'] = dto.notas.trim() || null;
    if (dto.fecha !== undefined) c['fecha'] = dto.fecha;
    if (Object.keys(c).length)
      await this.repo.actualizarLlegada(u.token, e.id, id, c);
    return LlegadaDto.desde(await this.repo.obtenerLlegada(u.token, e.id, id));
  }

  /** Elimina de la BD y revierte stock, kardex y avance de la OC. */
  async eliminarLlegada(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
  ): Promise<void> {
    await this.repo.eliminarLlegada(u.token, e.id, id);
  }

  async listarSalidas(
    u: UsuarioActual,
    e: EmpresaActual,
  ): Promise<SalidaDto[]> {
    return (await this.repo.listarSalidas(u.token, e.id)).map((f) =>
      SalidaDto.desde(f),
    );
  }

  async registrarSalida(
    u: UsuarioActual,
    e: EmpresaActual,
    dto: CrearSalidaDto,
  ): Promise<SalidaDto> {
    sinRepetidos(dto.items);
    const id = await this.repo.registrarSalida(u.token, e.id, dto);
    return SalidaDto.desde(await this.repo.obtenerSalida(u.token, e.id, id));
  }

  async actualizarSalida(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
    dto: ActualizarSalidaDto,
  ): Promise<SalidaDto> {
    const c: Record<string, unknown> = {};
    for (const k of [
      'destino',
      'responsable',
      'referencia',
      'notas',
    ] as const) {
      if (dto[k] !== undefined) c[k] = dto[k].trim() || null;
    }
    if (Object.keys(c).length)
      await this.repo.actualizarSalida(u.token, e.id, id, c);
    return SalidaDto.desde(await this.repo.obtenerSalida(u.token, e.id, id));
  }

  /** Elimina de la BD y devuelve el stock al almacén (en transferencias, lo quita del destino). */
  async eliminarSalida(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
  ): Promise<void> {
    await this.repo.eliminarSalida(u.token, e.id, id);
  }
}

function sinRepetidos(items: { productoId: string }[]) {
  if (new Set(items.map((i) => i.productoId)).size !== items.length) {
    throw new BadRequestException(
      'Hay productos repetidos; suma las cantidades en una sola línea',
    );
  }
}
