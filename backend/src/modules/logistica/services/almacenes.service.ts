import { Injectable } from '@nestjs/common';
import { eliminarConMensaje } from './eliminar.util.js';
import type { EmpresaActual, UsuarioActual } from '../../../common/index.js';
import {
  ActualizarAlmacenDto,
  AlmacenDto,
  CrearAlmacenDto,
} from '../dto/index.js';
import type { AlmacenEntity } from '../entities/index.js';
import { AlmacenesRepository } from '../repositories/index.js';

/** Almacenes: principal, unidades móviles de técnicos y obras. */
@Injectable()
export class AlmacenesService {
  constructor(private readonly repo: AlmacenesRepository) {}

  async listar(u: UsuarioActual, e: EmpresaActual): Promise<AlmacenDto[]> {
    const [almacenes, stock] = await Promise.all([
      this.repo.listar(u.token, e.id),
      this.repo.stockValorizado(u.token, e.id),
    ]);
    const porAlmacen = new Map<string, { productos: number; valor: number }>();
    for (const s of stock) {
      const a = porAlmacen.get(s.almacen_id) ?? { productos: 0, valor: 0 };
      a.productos += 1;
      a.valor += Number(s.cantidad) * Number(s.producto?.costo_promedio ?? 0);
      porAlmacen.set(s.almacen_id, a);
    }
    return almacenes.map((a) =>
      AlmacenDto.desde(
        a,
        porAlmacen.get(a.id)?.productos,
        porAlmacen.get(a.id)?.valor,
      ),
    );
  }

  async crear(
    u: UsuarioActual,
    e: EmpresaActual,
    dto: CrearAlmacenDto,
  ): Promise<AlmacenDto> {
    return AlmacenDto.desde(
      await this.repo.crear(u.token, { empresa_id: e.id, ...aFila(dto) }),
    );
  }

  async eliminar(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
  ): Promise<void> {
    await eliminarConMensaje(
      () => this.repo.eliminar(u.token, e.id, id),
      'El almacén',
      'Este almacén tiene stock, movimientos u órdenes. Transfiere su stock y desactívalo en lugar de eliminarlo.',
    );
  }

  async actualizar(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
    dto: ActualizarAlmacenDto,
  ): Promise<AlmacenDto> {
    return AlmacenDto.desde(
      await this.repo.actualizar(u.token, e.id, id, aFila(dto)),
    );
  }
}

function aFila(dto: ActualizarAlmacenDto): Partial<AlmacenEntity> {
  const f: Partial<AlmacenEntity> = {};
  if (dto.codigo !== undefined) f.codigo = dto.codigo;
  if (dto.nombre !== undefined) f.nombre = dto.nombre.trim();
  if (dto.tipo !== undefined) f.tipo = dto.tipo;
  if (dto.direccion !== undefined) f.direccion = dto.direccion.trim() || null;
  if (dto.responsable !== undefined)
    f.responsable = dto.responsable.trim() || null;
  if (dto.activo !== undefined) f.activo = dto.activo;
  return f;
}
