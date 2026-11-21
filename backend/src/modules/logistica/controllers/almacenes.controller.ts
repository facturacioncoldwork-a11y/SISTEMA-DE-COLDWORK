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
  ActualizarAlmacenDto,
  AlmacenDto,
  CrearAlmacenDto,
} from '../dto/index.js';
import { AlmacenesService } from '../services/index.js';

@ApiTags('Logística')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Empresa-Id',
  required: true,
  description: 'UUID de la empresa con la que se trabaja',
})
@RequiereArea(Area.Logistica)
@Controller({ path: 'logistica/almacenes', version: '1' })
export class AlmacenesController {
  constructor(private readonly almacenes: AlmacenesService) {}

  @Get()
  @ApiOkResponse({ type: [AlmacenDto] })
  listar(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.almacenes.listar(u, e);
  }

  @Post()
  @HttpCode(201)
  @ApiCreatedResponse({ type: AlmacenDto })
  crear(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Body() dto: CrearAlmacenDto,
  ) {
    return this.almacenes.crear(u, e, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AlmacenDto })
  actualizar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAlmacenDto,
  ) {
    return this.almacenes.actualizar(u, e, id, dto);
  }

  /** Elimina el almacén de la BD (solo si no tiene stock ni historial). */
  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  eliminar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.almacenes.eliminar(u, e, id);
  }
}
