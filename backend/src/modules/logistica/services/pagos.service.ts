import { Injectable, NotFoundException } from '@nestjs/common';
import type { EmpresaActual, UsuarioActual } from '../../../common/index.js';
import {
  ActualizarPagoDto,
  CrearPagoDto,
  OrdenCompraDto,
  OrdenConPagosDto,
  PagarDto,
  PagoDto,
} from '../dto/index.js';
import { EstadoOc, type CambiosPago } from '../entities/index.js';
import {
  OrdenesCompraRepository,
  PagosRepository,
} from '../repositories/index.js';

/**
 * Pagos a proveedores: el plan de pagos de cada orden de compra (adelanto, saldo, crédito),
 * para saber cuánto se debe y no olvidar ningún vencimiento. Solo el dueño (CEO).
 */
@Injectable()
export class PagosService {
  constructor(
    private readonly repo: PagosRepository,
    private readonly ordenes: OrdenesCompraRepository,
  ) {}

  /** Órdenes enviadas en adelante (o anuladas con pagos) con su plan de pagos. */
  async listar(
    u: UsuarioActual,
    e: EmpresaActual,
  ): Promise<OrdenConPagosDto[]> {
    const [filas, pagos] = await Promise.all([
      this.ordenes.listar(u.token, e.id),
      this.repo.listar(u.token, e.id),
    ]);
    const porOrden = new Map<string, PagoDto[]>();
    for (const p of pagos) {
      const lista = porOrden.get(p.orden_id) ?? [];
      lista.push(PagoDto.desde(p));
      porOrden.set(p.orden_id, lista);
    }
    return filas
      .filter((f) => {
        const conPagos = porOrden.has(f.id);
        return (
          conPagos ||
          (f.estado !== EstadoOc.Borrador && f.estado !== EstadoOc.Anulada)
        );
      })
      .map((f) => conPlan(OrdenCompraDto.desde(f), porOrden.get(f.id) ?? []));
  }

  async crear(
    u: UsuarioActual,
    e: EmpresaActual,
    dto: CrearPagoDto,
  ): Promise<PagoDto> {
    const f = await this.repo.crear(u.token, {
      empresa_id: e.id,
      orden_id: dto.ordenId,
      ...aFila(dto),
    });
    return PagoDto.desde(f);
  }

  async actualizar(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
    dto: ActualizarPagoDto,
  ): Promise<PagoDto> {
    return PagoDto.desde(
      await this.repo.actualizar(u.token, e.id, id, aFila(dto)),
    );
  }

  async pagar(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
    dto: PagarDto,
  ): Promise<PagoDto> {
    return PagoDto.desde(
      await this.repo.actualizar(u.token, e.id, id, {
        pagado_en: dto.pagadoEn,
        referencia: dto.referencia?.trim() || null,
      }),
    );
  }

  /** Se marcó por error: vuelve a pendiente. */
  async deshacer(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
  ): Promise<PagoDto> {
    return PagoDto.desde(
      await this.repo.actualizar(u.token, e.id, id, {
        pagado_en: null,
        referencia: null,
      }),
    );
  }

  async eliminar(
    u: UsuarioActual,
    e: EmpresaActual,
    id: string,
  ): Promise<void> {
    if (!(await this.repo.eliminar(u.token, e.id, id))) {
      throw new NotFoundException('El pago no existe o ya fue eliminado');
    }
  }
}

function aFila(dto: ActualizarPagoDto): CambiosPago {
  const f: CambiosPago = {};
  if (dto.concepto !== undefined) f.concepto = dto.concepto.trim();
  if (dto.porcentaje !== undefined) f.porcentaje = dto.porcentaje;
  if (dto.monto !== undefined) f.monto = dto.monto;
  if (dto.vence !== undefined) f.vence = dto.vence;
  if (dto.notas !== undefined) f.notas = dto.notas.trim() || null;
  return f;
}

/** Totales en céntimos para no arrastrar errores de coma flotante. */
export function conPlan(
  oc: OrdenCompraDto,
  pagos: PagoDto[],
): OrdenConPagosDto {
  const c = (n: number) => Math.round(n * 100);
  const pagado = pagos
    .filter((p) => p.pagadoEn)
    .reduce((t, p) => t + c(p.monto), 0);
  const plan = pagos.reduce((t, p) => t + c(p.monto), 0);
  // `oc` recién armado desde la fila: se le agregan los totales del plan
  return Object.assign(oc, {
    pagos: [...pagos].sort((x, y) => x.vence.localeCompare(y.vence)),
    pagado: pagado / 100,
    pendiente: (plan - pagado) / 100,
    sinPlan: Math.max(0, c(oc.total) - plan) / 100,
  });
}
