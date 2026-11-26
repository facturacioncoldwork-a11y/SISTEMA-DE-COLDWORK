import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Empresa,
  RequiereEmpresa,
  Rol,
  Usuario,
  type EmpresaActual,
  type UsuarioActual,
} from '../../../common/index.js';
import {
  ActualizarPagoDto,
  CrearPagoDto,
  OrdenConPagosDto,
  PagarDto,
  PagoDto,
} from '../dto/index.js';
import { PagosService } from '../services/index.js';

/** Pagos a proveedores por orden de compra. Solo el dueño (RLS lo vuelve a exigir). */
@ApiTags('Logística')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Empresa-Id',
  required: true,
  description: 'UUID de la empresa con la que se trabaja',
})
@RequiereEmpresa(Rol.Dueno)
@Controller({ path: 'logistica/pagos', version: '1' })
export class PagosController {
  constructor(private readonly pagos: PagosService) {}

  @Get()
  @ApiOkResponse({ type: [OrdenConPagosDto] })
  listar(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.pagos.listar(u, e);
  }

  @Post()
  @HttpCode(201)
  @ApiOkResponse({ type: PagoDto })
  crear(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Body() dto: CrearPagoDto,
  ) {
    return this.pagos.crear(u, e, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: PagoDto })
  actualizar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPagoDto,
  ) {
    return this.pagos.actualizar(u, e, id, dto);
  }

  @Post(':id/pagar')
  @ApiOkResponse({ type: PagoDto })
  pagar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PagarDto,
  ) {
    return this.pagos.pagar(u, e, id, dto);
  }

  @Post(':id/deshacer')
  @ApiOkResponse({ type: PagoDto })
  deshacer(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pagos.deshacer(u, e, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  eliminar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pagos.eliminar(u, e, id);
  }
}
