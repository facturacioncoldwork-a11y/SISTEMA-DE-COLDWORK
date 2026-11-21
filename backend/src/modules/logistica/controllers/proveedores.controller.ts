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
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Area,
  Empresa,
  RequiereArea,
  Usuario,
  type EmpresaActual,
  type UsuarioActual,
} from '../../../common/index.js';
import {
  ActualizarProveedorDto,
  CrearProveedorDto,
  ProveedorDto,
} from '../dto/index.js';
import { ProveedoresService } from '../services/index.js';

@ApiTags('Logística')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Empresa-Id',
  required: true,
  description: 'UUID de la empresa con la que se trabaja',
})
@RequiereArea(Area.Logistica)
@Controller({ path: 'logistica/proveedores', version: '1' })
export class ProveedoresController {
  constructor(private readonly proveedores: ProveedoresService) {}

  @Get()
  @ApiOkResponse({ type: [ProveedorDto] })
  listar(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.proveedores.listar(u, e);
  }

  @Post()
  @HttpCode(201)
  @ApiCreatedResponse({ type: ProveedorDto })
  crear(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Body() dto: CrearProveedorDto,
  ) {
    return this.proveedores.crear(u, e, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ProveedorDto })
  actualizar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarProveedorDto,
  ) {
    return this.proveedores.actualizar(u, e, id, dto);
  }

  /** Elimina el proveedor de la BD (solo si no tiene órdenes ni llegadas). */
  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  eliminar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.proveedores.eliminar(u, e, id);
  }
}
