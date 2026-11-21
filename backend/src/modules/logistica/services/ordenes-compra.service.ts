import { BadRequestException, Injectable } from '@nestjs/common';
import type { EmpresaActual, UsuarioActual } from '../../../common/index.js';
import {
  ActualizarOrdenCompraDto,
  CrearOrdenCompraDto,
  OrdenCompraDto,
} from '../dto/index.js';
import { EstadoOc, type CambiosOrdenCompra } from '../entities/index.js';
import { OrdenesCompraRepository } from '../repositories/index.js';
import { eliminarConMensaje } from './eliminar.util.js';

/**
 * Órdenes de compra: borrador → enviada → parcial → recibida (o anulada).
 * 'parcial' y 'recibida' las pone la BD al registrar llegadas.
 * El plazo del proveedor se guarda como texto ("2-3 semanas") + ventana de fechas.
 */
@Injectable()
export class OrdenesCompraService {
  constructor(private readonly repo: OrdenesCompraRepository) {}

  async listar(
    u: UsuarioActual,
    e: EmpresaActual,
    estado?: EstadoOc,
  ): Promise<OrdenCompraDto[]> {
    return (await this.repo.listar(u.token, e.id, estado)).map((f) =>
      OrdenCompraDto.desde(f),
    );
  }

  async obtener(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
  ): Promise<OrdenCompraDto> {
    return OrdenCompraDto.desde(await this.repo.obtener(u.token, e.id, id));
  }

  async crear(
    u: UsuarioActual,
    e: EmpresaActual,
    dto: CrearOrdenCompraDto,
  ): Promise<OrdenCompraDto> {
    sinRepetidos(dto.items);
    ventanaValida(dto.entregaDesde, dto.entregaHasta);
    const id = await this.repo.crear(u.token, e.id, dto);
    return this.obtener(u, e, id);
  }

  /** Edita la cabecera (plazo, cliente, fechas, notas…) y, si está en borrador, los productos. */
  async actualizar(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
    dto: ActualizarOrdenCompraDto,
  ): Promise<OrdenCompraDto> {
    const actual = await this.obtener(u, e, id);
    if (actual.estado === EstadoOc.Anulada)
      throw new BadRequestException('Una orden anulada no se edita');
    ventanaValida(
      dto.entregaDesde ?? actual.entregaDesde,
      dto.entregaHasta ?? actual.entregaHasta,
    );
    if (
      (dto.proveedorId ||
        dto.almacenId ||
        (dto.moneda && dto.moneda !== actual.moneda)) &&
      actual.estado !== EstadoOc.Borrador
    ) {
      throw new BadRequestException(
        'El proveedor, el almacén y la moneda solo se cambian en borrador',
      );
    }
    if (
      dto.entregadoCliente &&
      actual.estado !== EstadoOc.Recibida &&
      actual.estado !== EstadoOc.Parcial
    ) {
      throw new BadRequestException(
        'Solo se entrega al cliente lo que ya llegó al almacén',
      );
    }

    const c: CambiosOrdenCompra = {};
    const texto = (v: string | undefined) =>
      v === undefined ? undefined : v.trim() || null;
    if (dto.proveedorId !== undefined) c.proveedor_id = dto.proveedorId;
    if (dto.almacenId !== undefined) c.almacen_id = dto.almacenId;
    if (dto.plazoTexto !== undefined) c.plazo_texto = texto(dto.plazoTexto);
    if (dto.entregaDesde !== undefined) c.entrega_desde = dto.entregaDesde;
    if (dto.entregaHasta !== undefined) c.entrega_hasta = dto.entregaHasta;
    if (dto.notas !== undefined) c.notas = texto(dto.notas);
    if (dto.cliente !== undefined) c.cliente = texto(dto.cliente);
    if (dto.compromisoCliente !== undefined)
      c.compromiso_cliente = dto.compromisoCliente;
    if (dto.entregadoCliente !== undefined)
      c.entregado_cliente = dto.entregadoCliente;
    if (dto.condicionesPago !== undefined)
      c.condiciones_pago = texto(dto.condicionesPago);
    if (dto.lugarEntrega !== undefined)
      c.lugar_entrega = texto(dto.lugarEntrega);
    if (dto.atencion !== undefined) c.atencion = texto(dto.atencion);
    if (dto.solicitadoPor !== undefined)
      c.solicitado_por = texto(dto.solicitadoPor);
    if (dto.cotizacionRef !== undefined)
      c.cotizacion_ref = texto(dto.cotizacionRef);
    if (dto.moneda !== undefined) c.moneda = dto.moneda;

    if (Object.keys(c).length) await this.repo.actualizar(u.token, e.id, id, c);
    if (dto.items) {
      sinRepetidos(dto.items);
      await this.repo.reemplazarItems(u.token, e.id, id, dto.items);
    }
    return this.obtener(u, e, id);
  }

  async enviar(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
  ): Promise<OrdenCompraDto> {
    await this.repo.cambiarEstado(u.token, e.id, id, EstadoOc.Enviada);
    return this.obtener(u, e, id);
  }

  async anular(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
  ): Promise<OrdenCompraDto> {
    await this.repo.cambiarEstado(u.token, e.id, id, EstadoOc.Anulada);
    return this.obtener(u, e, id);
  }

  /** DELETE real (los ítems se borran en cascada). Si ya tiene llegadas, la BD lo impide. */
  async eliminar(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
  ): Promise<void> {
    await eliminarConMensaje(
      () => this.repo.eliminar(u.token, e.id, id),
      'La orden',
      'Esta orden ya tiene llegadas registradas. Elimina primero esas llegadas o anúlala.',
    );
  }
}

function sinRepetidos(items: { productoId: string }[]) {
  if (new Set(items.map((i) => i.productoId)).size !== items.length) {
    throw new BadRequestException('Hay productos repetidos en la orden');
  }
}

function ventanaValida(desde?: string | null, hasta?: string | null) {
  if (desde && hasta && desde > hasta) {
    throw new BadRequestException(
      'La fecha "desde" no puede ser posterior a "hasta"',
    );
  }
}
