import { Injectable } from '@nestjs/common';
import type { EmpresaActual, UsuarioActual } from '../../../common/index.js';
import {
  AjustesLogisticaDto,
  CambiarMonedaDto,
  GuardarAjustesLogisticaDto,
} from '../dto/index.js';
import {
  MESES_ANTIGUEDAD_POR_DEFECTO,
  MONEDA_INVENTARIO_POR_DEFECTO,
  type AjustesLogisticaEntity,
} from '../entities/index.js';
import { AjustesRepository } from '../repositories/index.js';

/** Ajustes de logística: desde cuándo un producto es "antiguo" y conviene venderlo. */
@Injectable()
export class AjustesService {
  constructor(private readonly repo: AjustesRepository) {}

  async obtener(
    u: UsuarioActual,
    e: EmpresaActual,
  ): Promise<AjustesLogisticaDto> {
    const fila = await this.repo.obtener(u.token, e.id);
    return {
      mesesAntiguedad: fila?.meses_antiguedad ?? MESES_ANTIGUEDAD_POR_DEFECTO,
      moneda: fila?.moneda ?? MONEDA_INVENTARIO_POR_DEFECTO,
      tipoCambioRef:
        fila?.tipo_cambio_ref == null ? null : Number(fila.tipo_cambio_ref),
    };
  }

  async guardar(
    u: UsuarioActual,
    e: EmpresaActual,
    dto: GuardarAjustesLogisticaDto,
  ): Promise<AjustesLogisticaDto> {
    const fila: AjustesLogisticaEntity = { empresa_id: e.id };
    if (dto.mesesAntiguedad !== undefined)
      fila.meses_antiguedad = dto.mesesAntiguedad;
    if (dto.tipoCambioRef !== undefined)
      fila.tipo_cambio_ref = dto.tipoCambioRef;
    await this.repo.guardar(u.token, fila);
    return this.obtener(u, e);
  }

  /** Pasa el inventario a soles o dólares convirtiendo los costos ya registrados. */
  async cambiarMoneda(
    u: UsuarioActual,
    e: EmpresaActual,
    dto: CambiarMonedaDto,
  ): Promise<AjustesLogisticaDto> {
    await this.repo.cambiarMoneda(
      u.token,
      e.id,
      dto.moneda,
      dto.tipoCambio ?? null,
    );
    return this.obtener(u, e);
  }
}
