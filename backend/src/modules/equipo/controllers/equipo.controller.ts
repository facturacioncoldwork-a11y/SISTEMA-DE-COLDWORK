import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  Empresa,
  RequiereEmpresa,
  Rol,
  Usuario,
  type EmpresaActual,
  type UsuarioActual,
} from '../../../common/index.js';
import { ActualizarMiembroDto, EquipoDto, InvitacionDto, InvitarDto } from '../dto/index.js';
import { EquipoService } from '../services/equipo.service.js';

/** Equipo de la empresa: invitar personas y darles acceso por áreas. SOLO EL DUEÑO (CEO). */
@ApiTags('Equipo')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Empresa-Id', required: true, description: 'UUID de la empresa con la que se trabaja' })
@RequiereEmpresa(Rol.Dueno)
@Controller({ path: 'equipo', version: '1' })
export class EquipoController {
  constructor(private readonly equipo: EquipoService) {}

  @Get()
  @ApiOkResponse({ type: EquipoDto })
  listar(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.equipo.listar(u, e);
  }

  /** Invita un correo. Al crear su cuenta (o entrar con Google) con ese correo, queda dentro. */
  @Post('invitaciones')
  @HttpCode(201)
  @ApiCreatedResponse({ type: InvitacionDto })
  invitar(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: InvitarDto) {
    return this.equipo.invitar(u, e, dto);
  }

  @Delete('invitaciones/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  cancelarInvitacion(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.equipo.cancelarInvitacion(u, e, id);
  }

  /** Cambia rol, áreas o bloquea/desbloquea a un miembro. */
  @Patch('miembros/:usuarioId')
  @HttpCode(204)
  @ApiNoContentResponse()
  actualizarMiembro(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Body() dto: ActualizarMiembroDto,
  ) {
    return this.equipo.actualizarMiembro(u, e, usuarioId, dto);
  }

  @Delete('miembros/:usuarioId')
  @HttpCode(204)
  @ApiNoContentResponse()
  quitarMiembro(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
  ) {
    return this.equipo.quitarMiembro(u, e, usuarioId);
  }
}
