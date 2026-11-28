import { Body, Controller, Get, HttpCode, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  Empresa,
  RequiereEmpresa,
  Rol,
  Usuario,
  type EmpresaActual,
  type UsuarioActual,
} from '../../../common/index.js';
import {
  ActualizarEmpresaDto,
  ConfigEmpresaDto,
  CrearEmpresaDto,
  EmpresaCreadaDto,
  EmpresaRespuestaDto,
  MiEmpresaDto,
} from '../dto/index.js';
import { EmpresasService } from '../services/empresas.service.js';

const CABECERA_EMPRESA = { name: 'X-Empresa-Id', required: true, description: 'UUID de la empresa con la que se trabaja' };

/** Rutas HTTP de empresas. Solo recibe/valida y delega al service. */
@ApiTags('Empresas')
@ApiBearerAuth()
@Controller({ path: 'empresas', version: '1' })
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}

  /** Empresas a las que pertenece el usuario (para el selector de empresa). */
  @Get('mias')
  @ApiOkResponse({ type: [MiEmpresaDto] })
  mias(@Usuario() u: UsuarioActual) {
    return this.empresas.mias(u);
  }

  /** Crea una empresa; quien la crea queda como dueño. */
  @Post()
  @HttpCode(201)
  @ApiCreatedResponse({ type: EmpresaCreadaDto })
  crear(@Usuario() u: UsuarioActual, @Body() dto: CrearEmpresaDto) {
    return this.empresas.crear(u, dto);
  }

  @Get('actual')
  @RequiereEmpresa()
  @ApiHeader(CABECERA_EMPRESA)
  @ApiOkResponse({ type: EmpresaRespuestaDto })
  actual(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.empresas.obtener(u, e.id);
  }

  @Patch('actual')
  @RequiereEmpresa(Rol.Dueno, Rol.Admin)
  @ApiHeader(CABECERA_EMPRESA)
  @ApiOkResponse({ type: EmpresaRespuestaDto })
  actualizar(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: ActualizarEmpresaDto) {
    return this.empresas.actualizar(u, e.id, dto);
  }

  /** Configuración de la empresa: la lee todo miembro (sale en los PDF). */
  @Get('actual/config')
  @RequiereEmpresa()
  @ApiHeader(CABECERA_EMPRESA)
  @ApiOkResponse({ type: ConfigEmpresaDto })
  config(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.empresas.config(u, e.id);
  }

  /** Solo dueño o administrador (la base de datos también lo exige). */
  @Put('actual/config')
  @HttpCode(204)
  @RequiereEmpresa(Rol.Dueno, Rol.Admin)
  @ApiHeader(CABECERA_EMPRESA)
  guardarConfig(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual, @Body() dto: ConfigEmpresaDto) {
    return this.empresas.guardarConfig(u, e.id, dto);
  }
}
