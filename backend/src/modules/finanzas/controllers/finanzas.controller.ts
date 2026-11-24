import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Empresa, RequiereEmpresa, Usuario, type EmpresaActual, type UsuarioActual } from '../../../common/index.js';
import { AnularDto, ComprobanteDto, CuentaDto, MovimientoDto, TerceroDto } from '../dto/finanzas.dto.js';
import { FinanzasService } from '../services/finanzas.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Finanzas: clientes y proveedores, ventas, compras, caja y bancos, cuentas por cobrar y pagar.
 * Cualquier miembro puede llamar, pero la base de datos decide por área (RLS y funciones):
 * ventas → área ventas · compras → contabilidad/finanzas · caja → finanzas.
 */
@ApiTags('Finanzas')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Empresa-Id', required: true, description: 'UUID de la empresa con la que se trabaja' })
@RequiereEmpresa()
@Controller({ path: 'finanzas', version: '1' })
export class FinanzasController {
  constructor(private readonly fin: FinanzasService) {}

  // ─── Resumen ─────────────────────────────────────────────────

  @Get('resumen')
  resumen(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.fin.resumen(u, e);
  }

  // ─── Clientes y proveedores ──────────────────────────────────

  @Get('terceros')
  terceros(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.fin.terceros(u, e);
  }

  @Post('terceros')
  @HttpCode(201)
  crearTercero(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: TerceroDto) {
    return this.fin.crearTercero(u, e, dto);
  }

  @Patch('terceros/:id')
  @HttpCode(204)
  actualizarTercero(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TerceroDto,
  ) {
    return this.fin.actualizarTercero(u, e, id, dto);
  }

  @Delete('terceros/:id')
  @HttpCode(204)
  eliminarTercero(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.fin.eliminarTercero(u, e, id);
  }

  // ─── Comprobantes (ventas y compras) ─────────────────────────

  @Get('comprobantes')
  @ApiQuery({ name: 'operacion', enum: ['venta', 'compra'] })
  @ApiQuery({ name: 'desde', required: false, example: '2026-11-01' })
  @ApiQuery({ name: 'hasta', required: false, example: '2026-11-30' })
  comprobantes(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Query('operacion') operacion: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.fin.comprobantes(u, e, operacion, desde, hasta);
  }

  /** Cuentas por cobrar (venta) o por pagar (compra), con días de atraso. */
  @Get('pendientes')
  @ApiQuery({ name: 'operacion', enum: ['venta', 'compra'] })
  pendientes(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Query('operacion') operacion: string) {
    return this.fin.pendientes(u, e, operacion);
  }

  /** Registra el comprobante y su asiento contable automático. */
  @Post('comprobantes')
  @HttpCode(201)
  registrarComprobante(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: ComprobanteDto) {
    return this.fin.registrarComprobante(u, e, dto);
  }

  @Post('comprobantes/:id/anular')
  @HttpCode(204)
  anularComprobante(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnularDto,
  ) {
    return this.fin.anularComprobante(u, e, id, dto);
  }

  // ─── Caja y bancos ───────────────────────────────────────────

  @Get('cuentas')
  cuentas(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.fin.cuentas(u, e);
  }

  @Post('cuentas')
  @HttpCode(201)
  crearCuenta(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: CuentaDto) {
    return this.fin.guardarCuenta(u, e, null, dto);
  }

  @Patch('cuentas/:id')
  actualizarCuenta(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CuentaDto,
  ) {
    return this.fin.guardarCuenta(u, e, id, dto);
  }

  @Get('movimientos')
  @ApiQuery({ name: 'cuenta', required: false })
  @ApiQuery({ name: 'desde', required: false })
  @ApiQuery({ name: 'hasta', required: false })
  movimientos(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Query('cuenta') cuenta?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    if (cuenta && !UUID.test(cuenta)) throw new BadRequestException('Cuenta inválida');
    return this.fin.movimientos(u, e, cuenta, desde, hasta);
  }

  /** Cobro, pago, ingreso, egreso o transferencia, con su asiento contable automático. */
  @Post('movimientos')
  @HttpCode(201)
  registrarMovimiento(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: MovimientoDto) {
    return this.fin.registrarMovimiento(u, e, dto);
  }

  @Post('movimientos/:id/anular')
  @HttpCode(204)
  anularMovimiento(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnularDto,
  ) {
    return this.fin.anularMovimiento(u, e, id, dto);
  }

  // ─── Reportes ────────────────────────────────────────────────

  /** Debe y Haber por cuenta contable (asientos registrados) entre dos fechas. */
  @Get('saldos-contables')
  @ApiQuery({ name: 'desde', required: false, description: 'Vacío = desde el inicio (balance)' })
  @ApiQuery({ name: 'hasta', example: '2026-11-30' })
  saldosContables(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Query('hasta') hasta: string,
    @Query('desde') desde?: string,
  ) {
    return this.fin.saldosContables(u, e, desde, hasta);
  }
}
