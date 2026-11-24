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
import type { LoteEntity, ProductoEntity } from '../entities/index.js';
import { ProductosRepository } from '../repositories/index.js';

/** Inventario: catálogo de productos, stock por almacén, kardex y panel. */
@Injectable()
export class ProductosService {
  constructor(private readonly repo: ProductosRepository) {}

  async listar(u: UsuarioActual, e: EmpresaActual): Promise<ProductoDto[]> {
    const [filas, lotes] = await Promise.all([
      this.repo.listar(u.token, e.id),
      this.repo.lotes(u.token, e.id),
    ]);
    const porProducto = new Map<string, LoteEntity[]>();
    for (const l of lotes) {
      const lista = porProducto.get(l.producto_id) ?? [];
      lista.push(l);
      porProducto.set(l.producto_id, lista);
    }
    return filas.map((f) => ProductoDto.desde(f, porProducto.get(f.id)));
  }

  /** Un producto con su stock y sus lotes. */
  private async uno(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
  ): Promise<ProductoDto> {
    const [fila, lotes] = await Promise.all([
      this.repo.obtener(u.token, e.id, id),
      this.repo.lotes(u.token, e.id, id),
    ]);
    return ProductoDto.desde(fila, lotes);
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
    return this.uno(u, e, id);
  }

  async actualizar(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
    dto: ActualizarProductoDto,
  ): Promise<ProductoDto> {
    await this.repo.actualizar(u.token, e.id, id, aFila(dto));
    return this.uno(u, e, id);
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
    const [movs, producto] = await Promise.all([
      this.repo.kardex(u.token, e.id, id),
      this.repo.obtener(u.token, e.id, id),
    ]);
    return conSaldoReal(
      movs.map((m) => MovimientoDto.desde(m)),
      producto.stock ?? [],
    );
  }

  async resumen(
    u: UsuarioActual,
    e: EmpresaActual,
  ): Promise<ResumenLogisticaDto> {
    return (await this.repo.resumen(u.token, e.id)) as ResumenLogisticaDto;
  }
}

/**
 * Saldo de cada línea del kardex calculado hacia atrás desde el stock actual de cada almacén.
 * Así es correcto aunque una llegada se haya registrado o corregido con una fecha pasada
 * (el saldo guardado en la BD es el del momento en que se registró).
 * `movs` viene del más reciente al más antiguo.
 */
export function conSaldoReal(
  movs: MovimientoDto[],
  stock: { almacen_id: string; cantidad: number }[],
): MovimientoDto[] {
  const saldo = new Map(stock.map((s) => [s.almacen_id, Number(s.cantidad)]));
  return movs.map((m) => {
    const despues = saldo.get(m.almacenId) ?? 0;
    const antes = despues + (m.tipo === 'entrada' ? -m.cantidad : m.cantidad);
    saldo.set(m.almacenId, Math.round(antes * 1000) / 1000);
    m.saldo = despues;
    return m;
  });
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
