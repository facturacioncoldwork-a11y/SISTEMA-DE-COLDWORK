import { Injectable } from '@nestjs/common';
import { eliminarConMensaje } from './eliminar.util.js';
import type { EmpresaActual, UsuarioActual } from '../../../common/index.js';
import {
  ActualizarProveedorDto,
  CrearProveedorDto,
  ProveedorDto,
} from '../dto/index.js';
import type { TerceroEntity } from '../entities/index.js';
import { ProveedoresRepository } from '../repositories/index.js';

/** Gestión de proveedores (tabla `terceros` con es_proveedor = true). */
@Injectable()
export class ProveedoresService {
  constructor(private readonly repo: ProveedoresRepository) {}

  async listar(u: UsuarioActual, e: EmpresaActual): Promise<ProveedorDto[]> {
    return (await this.repo.listar(u.token, e.id)).map((t) =>
      ProveedorDto.desde(t),
    );
  }

  async crear(
    u: UsuarioActual,
    e: EmpresaActual,
    dto: CrearProveedorDto,
  ): Promise<ProveedorDto> {
    return ProveedorDto.desde(
      await this.repo.crear(u.token, {
        empresa_id: e.id,
        es_proveedor: true,
        ...aFila(dto),
      }),
    );
  }

  async eliminar(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
  ): Promise<void> {
    await eliminarConMensaje(
      () => this.repo.eliminar(u.token, e.id, id),
      'El proveedor',
      'Este proveedor tiene órdenes de compra o llegadas registradas. Desactívalo en lugar de eliminarlo.',
    );
  }

  async actualizar(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
    dto: ActualizarProveedorDto,
  ): Promise<ProveedorDto> {
    return ProveedorDto.desde(
      await this.repo.actualizar(u.token, e.id, id, aFila(dto)),
    );
  }
}

function aFila(dto: ActualizarProveedorDto): Partial<TerceroEntity> {
  const f: Partial<TerceroEntity> = {};
  const texto = (v: string | undefined) =>
    v === undefined ? undefined : v.trim() || null;
  if (dto.tipoDocumento !== undefined) f.tipo_documento = dto.tipoDocumento;
  if (dto.numeroDocumento !== undefined)
    f.numero_documento = dto.numeroDocumento;
  if (dto.razonSocial !== undefined) f.razon_social = dto.razonSocial.trim();
  if (dto.rubro !== undefined) f.rubro = texto(dto.rubro) ?? null;
  if (dto.contacto !== undefined) f.contacto = texto(dto.contacto) ?? null;
  if (dto.telefono !== undefined) f.telefono = texto(dto.telefono) ?? null;
  if (dto.correo !== undefined)
    f.correo = texto(dto.correo)?.toLowerCase() ?? null;
  if (dto.direccion !== undefined) f.direccion = texto(dto.direccion) ?? null;
  if (dto.diasCredito !== undefined) f.dias_credito = dto.diasCredito;
  if (dto.calificacion !== undefined) f.calificacion = dto.calificacion;
  if (dto.activo !== undefined) f.activo = dto.activo;
  return f;
}
