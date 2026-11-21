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
  ActualizarProductoDto,
  CrearProductoDto,
  MovimientoDto,
  ProductoDto,
  ResumenLogisticaDto,
} from '../dto/index.js';
import { ProductosService } from '../services/index.js';

/** Inventario: productos, stock por almacén, kardex y panel. */
@ApiTags('Logística')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Empresa-Id',
  required: true,
  description: 'UUID de la empresa con la que se trabaja',
})
@RequiereArea(Area.Logistica)
@Controller({ path: 'logistica', version: '1' })
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  /** Indicadores del panel de logística. */
  @Get('resumen')
  @ApiOkResponse({ type: ResumenLogisticaDto })
  resumen(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.productos.resumen(u, e);
  }

  @Get('productos')
  @ApiOkResponse({ type: [ProductoDto] })
  listar(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.productos.listar(u, e);
  }

  @Post('productos')
  @HttpCode(201)
  @ApiCreatedResponse({ type: ProductoDto })
  crear(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Body() dto: CrearProductoDto,
  ) {
    return this.productos.crear(u, e, dto);
  }

  @Patch('productos/:id')
  @ApiOkResponse({ type: ProductoDto })
  actualizar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarProductoDto,
  ) {
    return this.productos.actualizar(u, e, id, dto);
  }

  /** Kardex: cada entrada y salida del producto, con el saldo después de cada una. */
  @Get('productos/:id/kardex')
  @ApiOkResponse({ type: [MovimientoDto] })
  kardex(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productos.kardex(u, e, id);
  }

  /** Elimina el producto de la BD (solo si no tiene historial). */
  @Delete('productos/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  eliminar(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productos.eliminar(u, e, id);
  }
}
