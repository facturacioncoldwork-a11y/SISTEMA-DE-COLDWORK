import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Empresa, Publica, RequiereEmpresa, Usuario, type EmpresaActual, type UsuarioActual } from '../../../common/index.js';
import { AusenciaDto, HorarioDto, MarcaManualDto, MarcarDto, TabletaDto } from '../dto/asistencia.dto.js';
import { AsistenciaService } from '../services/asistencia.service.js';

/**
 * Asistencia. Cualquier miembro marca SU entrada y salida; el dueño, el admin y el área
 * Personal ven a todos, aprueban y configuran. Los permisos los exige la base de datos.
 */
@ApiTags('Asistencia')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Empresa-Id', required: true, description: 'UUID de la empresa' })
@RequiereEmpresa()
@Controller({ path: 'asistencia', version: '1' })
export class AsistenciaController {
  constructor(private readonly asistencia: AsistenciaService) {}

  @Get('horario')
  horario(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.asistencia.horario(u, e);
  }

  @Put('horario')
  @HttpCode(204)
  guardarHorario(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: HorarioDto) {
    return this.asistencia.guardarHorario(u, e, dto);
  }

  /** Marcas y ausencias del rango (cada uno ve las suyas; Personal ve todas). Máximo 3 meses. */
  @Get('marcas')
  @ApiQuery({ name: 'desde', example: '2026-11-01' })
  @ApiQuery({ name: 'hasta', example: '2026-11-30' })
  marcas(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Query('desde') desde: string, @Query('hasta') hasta: string) {
    return this.asistencia.marcas(u, e, desde, hasta);
  }

  /** Marca propia (entrada o salida). La hora la pone el servidor. */
  @Post('marcar')
  marcar(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: MarcarDto) {
    return this.asistencia.marcar(u, e, dto);
  }

  @Post('marcas/manual')
  marcarManual(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: MarcaManualDto) {
    return this.asistencia.marcarManual(u, e, dto);
  }

  @Post('marcas/:id/aprobar')
  @HttpCode(204)
  aprobar(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.asistencia.aprobar(u, e, id);
  }

  /** Código vigente para la tablet de la oficina (solo dueño o Personal). */
  @Get('codigo-oficina')
  codigoOficina(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.asistencia.codigoOficina(u, e);
  }

  @Post('ausencias')
  @HttpCode(204)
  registrarAusencia(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: AusenciaDto) {
    return this.asistencia.registrarAusencia(u, e, dto);
  }

  // ─── Tabletas de la oficina (solo dueño o encargado de asistencia) ──
  @Get('tabletas')
  tabletas(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.asistencia.tabletas(u, e);
  }

  /** Devuelve el token UNA sola vez (en la base solo queda su hash). */
  @Post('tabletas')
  crearTableta(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: TabletaDto) {
    return this.asistencia.crearTableta(u, e, dto.nombre);
  }

  @Post('tabletas/:id/desactivar')
  @HttpCode(204)
  desactivarTableta(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.asistencia.desactivarTableta(u, e, id);
  }
}

/**
 * La tablet de la oficina pide el código SIN iniciar sesión, solo con su token
 * (cabecera X-Tableta-Token). Límite de peticiones más estricto.
 */
@ApiTags('Asistencia')
@Controller({ path: 'tableta', version: '1' })
export class TabletaController {
  constructor(private readonly asistencia: AsistenciaService) {}

  @Publica()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('codigo')
  codigo(@Headers('x-tableta-token') token: string | undefined) {
    return this.asistencia.codigoTableta(token);
  }
}
