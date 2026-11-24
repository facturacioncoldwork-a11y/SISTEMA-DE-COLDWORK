import { Injectable } from '@nestjs/common';
import type { EmpresaActual, UsuarioActual } from '../../../common/index.js';
import {
  AjustesLogisticaDto,
  GuardarAjustesLogisticaDto,
} from '../dto/index.js';
import { MESES_ANTIGUEDAD_POR_DEFECTO } from '../entities/index.js';
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
    };
  }

  async guardar(
    u: UsuarioActual,
    e: EmpresaActual,
    dto: GuardarAjustesLogisticaDto,
  ): Promise<AjustesLogisticaDto> {
    await this.repo.guardar(u.token, {
      empresa_id: e.id,
      meses_antiguedad: dto.mesesAntiguedad,
    });
    return this.obtener(u, e);
  }
}
