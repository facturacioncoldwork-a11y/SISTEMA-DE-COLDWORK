import { Injectable } from '@nestjs/common';
import { eliminarConMensaje } from './eliminar.util.js';
import type { EmpresaActual, UsuarioActual } from '../../../common/index.js';
import {
  ActualizarProductoDto,
  CrearProductoDto,
  MovimientoDto,
  ProductoDto,
  ResumenLogisticaDto,
} from '../dto/index.js';
import type { ProductoEntity } from '../entities/index.js';
import { ProductosRepository } from '../repositories/index.js';

/** Inventario: catálogo de productos, stock por almacén, kardex y panel. */
@Injectable()
export class ProductosService {
  constructor(private readonly repo: ProductosRepository) {}

  async listar(u: UsuarioActual, e: EmpresaActual): Promise<ProductoDto[]> {
    return (await this.repo.listar(u.token, e.id)).map((f) =>
      ProductoDto.desde(f),
    );
  }

  async crear(
    u: UsuarioActual,
    e: EmpresaActual,
    dto: CrearProductoDto,
  ): Promise<ProductoDto> {
    const id = await this.repo.crear(u.token, {
      empresa_id: e.id,
      ...aFila(dto),
    });
    return ProductoDto.desde(await this.repo.obtener(u.token, e.id, id));
  }

  async actualizar(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
    dto: ActualizarProductoDto,
  ): Promise<ProductoDto> {
    await this.repo.actualizar(u.token, e.id, id, aFila(dto));
    return ProductoDto.desde(await this.repo.obtener(u.token, e.id, id));
  }

  async eliminar(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
  ): Promise<void> {
    await eliminarConMensaje(
      () => this.repo.eliminar(u.token, e.id, id),
      'El producto',
      'Este producto ya tiene movimientos u órdenes de compra. Para no romper el kardex, desactívalo en lugar de eliminarlo.',
    );
  }

  async kardex(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
  ): Promise<MovimientoDto[]> {
    return (await this.repo.kardex(u.token, e.id, id)).map((m) =>
      MovimientoDto.desde(m),
    );
  }

  async resumen(
    u: UsuarioActual,
    e: EmpresaActual,
  ): Promise<ResumenLogisticaDto> {
    return (await this.repo.resumen(u.token, e.id)) as ResumenLogisticaDto;
  }
}

/** DTO (camelCase) → columnas de la tabla (snake_case). Solo lo que vino. */
function aFila(dto: ActualizarProductoDto): Partial<ProductoEntity> {
  const f: Partial<ProductoEntity> = {};
  if (dto.sku !== undefined) f.sku = dto.sku;
  if (dto.nombre !== undefined) f.nombre = dto.nombre.trim();
  if (dto.descripcion !== undefined)
    f.descripcion = dto.descripcion.trim() || null;
  if (dto.tipo !== undefined) f.tipo = dto.tipo;
  if (dto.marca !== undefined) f.marca = dto.marca.trim() || null;
  if (dto.unidad !== undefined) f.unidad = dto.unidad;
  if (dto.stockMinimo !== undefined) f.stock_minimo = dto.stockMinimo;
  if (dto.activo !== undefined) f.activo = dto.activo;
  return f;
}
