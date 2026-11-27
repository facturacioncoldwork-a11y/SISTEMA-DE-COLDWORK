import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Area,
  Empresa,
  RequiereArea,
  RequiereEmpresa,
  Rol,
  Usuario,
  type EmpresaActual,
  type UsuarioActual,
} from '../../../common/index.js';
import {
  AjustesLogisticaDto,
  CambiarMonedaDto,
  GuardarAjustesLogisticaDto,
} from '../dto/index.js';
import { AjustesService } from '../services/index.js';

/** Ajustes de logística (p. ej. desde cuántos meses un producto es antiguo). */
@ApiTags('Logística')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Empresa-Id',
  required: true,
  description: 'UUID de la empresa con la que se trabaja',
})
@RequiereArea(Area.Logistica)
@Controller({ path: 'logistica/ajustes', version: '1' })
export class AjustesController {
  constructor(private readonly ajustes: AjustesService) {}

  @Get()
  @ApiOkResponse({ type: AjustesLogisticaDto })
  obtener(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.ajustes.obtener(u, e);
  }

  /** Solo el dueño o un admin cambian el límite (RLS lo vuelve a exigir). */
  @Put()
  @RequiereEmpresa(Rol.Dueno, Rol.Admin)
  @ApiOkResponse({ type: AjustesLogisticaDto })
  guardar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Body() dto: GuardarAjustesLogisticaDto,
  ) {
    return this.ajustes.guardar(u, e, dto);
  }

  /** Moneda del inventario: convierte los costos ya registrados. Solo el dueño (la BD lo exige). */
  @Post('moneda')
  @RequiereEmpresa(Rol.Dueno)
  @ApiOkResponse({ type: AjustesLogisticaDto })
  cambiarMoneda(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Body() dto: CambiarMonedaDto,
  ) {
    return this.ajustes.cambiarMoneda(u, e, dto);
  }
}
