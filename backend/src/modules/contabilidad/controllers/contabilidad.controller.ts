import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiNoContentResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  Area,
  Empresa,
  RequiereArea,
  Usuario,
  type EmpresaActual,
  type UsuarioActual,
} from '../../../common/index.js';
import { CambiarEstadoDto, ConfigContableDto, GuardarAsientoDto } from '../dto/asiento.dto.js';
import { ContabilidadService } from '../services/contabilidad.service.js';

@ApiTags('Contabilidad')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Empresa-Id', required: true, description: 'UUID de la empresa con la que se trabaja' })
@RequiereArea(Area.Contabilidad)
@Controller({ path: 'contabilidad', version: '1' })
export class ContabilidadController {
  constructor(private readonly conta: ContabilidadService) {}

  // ─── Lectura ─────────────────────────────────────────────────

  /** Todo lo de la pantalla en una sola petición (más rápido). */
  @Get('panel')
  @ApiQuery({ name: 'periodo', example: '2026-11' })
  panel(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Query('periodo') periodo: string) {
    return this.conta.panel(u, e, periodo);
  }

  /** Asientos de un periodo (AAAA-MM) con sus líneas. */
  @Get('asientos')
  @ApiQuery({ name: 'periodo', example: '2026-11' })
  asientos(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Query('periodo') periodo: string) {
    return this.conta.asientos(u, e, periodo);
  }

  /** Asientos que esperan aprobación (de cualquier periodo). */
  @Get('por-aprobar')
  porAprobar(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.conta.porAprobar(u, e);
  }

  @Get('periodos')
  periodos(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.conta.periodos(u, e);
  }

  /** Historial: quién hizo qué y cuándo (últimos 40). */
  @Get('actividad')
  actividad(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.conta.actividad(u, e);
  }

  @Get('config')
  config(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.conta.config(u, e);
  }

  // ─── Escritura ───────────────────────────────────────────────

  /** Solo el dueño o un admin (lo verifica la base de datos). */
  @Put('config')
  guardarConfig(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: ConfigContableDto) {
    return this.conta.guardarConfig(u, e, dto);
  }

  @Post('asientos')
  @HttpCode(201)
  crear(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: GuardarAsientoDto) {
    return this.conta.crear(u, e, dto);
  }

  /** Corrige un borrador u observado. */
  @Patch('asientos/:id')
  actualizar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GuardarAsientoDto,
  ) {
    return this.conta.actualizar(u, e, id, dto);
  }

  /** enviar · registrar (o aprobar) · observar · anular · eliminar (borrador). */
  @Post('asientos/:id/estado')
  @HttpCode(204)
  @ApiNoContentResponse()
  cambiarEstado(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoDto,
  ) {
    return this.conta.cambiarEstado(u, e, id, dto);
  }
}
