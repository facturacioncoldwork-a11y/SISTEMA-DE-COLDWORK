import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiQuery,
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
  ActualizarOrdenCompraDto,
  CrearOrdenCompraDto,
  OrdenCompraDto,
} from '../dto/index.js';
import { EstadoOc } from '../entities/index.js';
import { OrdenesCompraService } from '../services/index.js';

@ApiTags('Logística')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Empresa-Id',
  required: true,
  description: 'UUID de la empresa con la que se trabaja',
})
@RequiereArea(Area.Logistica)
@Controller({ path: 'logistica/ordenes-compra', version: '1' })
export class OrdenesCompraController {
  constructor(private readonly ordenes: OrdenesCompraService) {}

  @Get()
  @ApiQuery({ name: 'estado', enum: EstadoOc, required: false })
  @ApiOkResponse({ type: [OrdenCompraDto] })
  listar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Query('estado', new ParseEnumPipe(EstadoOc, { optional: true }))
    estado?: EstadoOc,
  ) {
    return this.ordenes.listar(u, e, estado);
  }

  @Get(':id')
  @ApiOkResponse({ type: OrdenCompraDto })
  obtener(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordenes.obtener(u, e, id);
  }

  @Post()
  @HttpCode(201)
  @ApiCreatedResponse({ type: OrdenCompraDto })
  crear(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Body() dto: CrearOrdenCompraDto,
  ) {
    return this.ordenes.crear(u, e, dto);
  }

  /** Borrador → enviada al proveedor. */
  @Post(':id/enviar')
  @HttpCode(200)
  @ApiOkResponse({ type: OrdenCompraDto })
  enviar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordenes.enviar(u, e, id);
  }

  /** Solo si aún no recibió nada. */
  @Post(':id/anular')
  @HttpCode(200)
  @ApiOkResponse({ type: OrdenCompraDto })
  anular(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordenes.anular(u, e, id);
  }

  /** Edita plazo, cliente, fechas y notas; en borrador también proveedor, almacén y productos. */
  @Patch(':id')
  @ApiOkResponse({ type: OrdenCompraDto })
  actualizar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarOrdenCompraDto,
  ) {
    return this.ordenes.actualizar(u, e, id, dto);
  }

  /** Elimina la orden de la BD (solo si no tiene llegadas). */
  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  eliminar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordenes.eliminar(u, e, id);
  }
}
