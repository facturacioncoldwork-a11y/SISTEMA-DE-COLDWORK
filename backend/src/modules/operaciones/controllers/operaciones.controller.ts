import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Empresa, RequiereEmpresa, Usuario, type EmpresaActual, type UsuarioActual } from '../../../common/index.js';
import { AprobarCotizacionDto, EstadoCotizacionDto, GuardarDocumentoDto, GuardarEquipoDto, MensajeDto } from '../dto/operaciones.dto.js';
import { OperacionesService } from '../services/operaciones.service.js';

/**
 * Operaciones: cotizaciones (Ventas), servicios de principio a fin, equipos de los clientes y
 * órdenes de trabajo con su informe técnico. Los permisos por área los exige la base de datos.
 */
@ApiTags('Operaciones')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Empresa-Id', required: true, description: 'UUID de la empresa' })
@RequiereEmpresa()
@Controller({ path: 'operaciones', version: '1' })
export class OperacionesController {
  constructor(private readonly ope: OperacionesService) {}

  /** Personal de la empresa (nombre y áreas, sin correos) para asignar tareas y técnicos. */
  @Get('directorio')
  directorio(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.ope.directorio(u, e);
  }

  // ─── Cotizaciones ──────────────────────────────────────────────
  @Get('cotizaciones')
  cotizaciones(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.ope.cotizaciones(u, e);
  }

  @Put('cotizaciones/:id')
  guardarCotizacion(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GuardarDocumentoDto) {
    return this.ope.guardarCotizacion(u, e, id, dto);
  }

  @Post('cotizaciones/:id/estado')
  @HttpCode(204)
  estadoCotizacion(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EstadoCotizacionDto) {
    return this.ope.estadoCotizacion(u, e, id, dto);
  }

  @Post('cotizaciones/:id/aprobar')
  aprobarCotizacion(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AprobarCotizacionDto) {
    return this.ope.aprobarCotizacion(u, e, id, dto);
  }

  // ─── Servicios ─────────────────────────────────────────────────
  @Get('expedientes')
  expedientes(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.ope.expedientes(u, e);
  }

  @Put('expedientes/:id')
  guardarExpediente(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GuardarDocumentoDto) {
    return this.ope.guardarExpediente(u, e, id, dto);
  }

  @Get('expedientes/:id/historial')
  historial(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.ope.historial(u, e, id);
  }

  // ─── Equipos y órdenes de trabajo ─────────────────────────────
  @Get('equipos')
  equipos(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.ope.equipos(u, e);
  }

  @Put('equipos/:id')
  @HttpCode(204)
  guardarEquipo(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GuardarEquipoDto) {
    return this.ope.guardarEquipo(u, e, id, dto);
  }

  @Get('ordenes')
  ordenes(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.ope.ordenes(u, e);
  }

  @Put('ordenes/:id')
  guardarOrden(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GuardarDocumentoDto) {
    return this.ope.guardarOrden(u, e, id, dto);
  }

  @Get('ordenes/:id/mensajes')
  mensajes(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.ope.mensajes(u, e, id);
  }

  @Post('ordenes/:id/mensajes')
  enviarMensaje(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MensajeDto) {
    return this.ope.enviarMensaje(u, e, id, dto.texto);
  }
}
