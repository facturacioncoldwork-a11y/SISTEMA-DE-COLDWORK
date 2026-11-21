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
  ActualizarLlegadaDto,
  ActualizarSalidaDto,
  CrearLlegadaDto,
  CrearSalidaDto,
  LlegadaDto,
  SalidaDto,
} from '../dto/index.js';
import { MovimientosService } from '../services/index.js';

/** Llegada (entrada) y salida (despacho) de producto. */
@ApiTags('Logística')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Empresa-Id',
  required: true,
  description: 'UUID de la empresa con la que se trabaja',
})
@RequiereArea(Area.Logistica)
@Controller({ path: 'logistica', version: '1' })
export class MovimientosController {
  constructor(private readonly movimientos: MovimientosService) {}

  @Get('llegadas')
  @ApiOkResponse({ type: [LlegadaDto] })
  listarLlegadas(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.movimientos.listarLlegadas(u, e);
  }

  /** Suma stock, actualiza costo promedio y, si viene de una OC, su avance. */
  @Post('llegadas')
  @HttpCode(201)
  @ApiCreatedResponse({ type: LlegadaDto })
  registrarLlegada(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Body() dto: CrearLlegadaDto,
  ) {
    return this.movimientos.registrarLlegada(u, e, dto);
  }

  @Get('salidas')
  @ApiOkResponse({ type: [SalidaDto] })
  listarSalidas(@Usuario() u: UsuarioActual, @Empresa() e: EmpresaActual) {
    return this.movimientos.listarSalidas(u, e);
  }

  /** Resta stock (nunca deja negativos). Transferencia: pasa a otro almacén. */
  @Post('salidas')
  @HttpCode(201)
  @ApiCreatedResponse({ type: SalidaDto })
  registrarSalida(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Body() dto: CrearSalidaDto,
  ) {
    return this.movimientos.registrarSalida(u, e, dto);
  }

  /** Corrige guía, comprobante, notas o fecha. Las cantidades no se editan: se elimina y se registra otra vez. */
  @Patch('llegadas/:id')
  @ApiOkResponse({ type: LlegadaDto })
  actualizarLlegada(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarLlegadaDto,
  ) {
    return this.movimientos.actualizarLlegada(u, e, id, dto);
  }

  /** Elimina la llegada de la BD revirtiendo stock, kardex y avance de la OC. */
  @Delete('llegadas/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  eliminarLlegada(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.movimientos.eliminarLlegada(u, e, id);
  }

  @Patch('salidas/:id')
  @ApiOkResponse({ type: SalidaDto })
  actualizarSalida(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarSalidaDto,
  ) {
    return this.movimientos.actualizarSalida(u, e, id, dto);
  }

  /** Elimina la salida de la BD devolviendo el stock. */
  @Delete('salidas/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  eliminarSalida(
    @Usuario() u: UsuarioActual,
    @Empresa() e: EmpresaActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.movimientos.eliminarSalida(u, e, id);
  }
}
