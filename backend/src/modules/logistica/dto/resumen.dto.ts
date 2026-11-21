import { ApiProperty } from '@nestjs/swagger';
import { TipoProducto } from '../entities/producto.entity.js';

export class FlujoDiaDto {
  @ApiProperty({ example: '2026-11-20' }) dia!: string;
  @ApiProperty({ description: 'Valor de entradas (S/)' }) entradas!: number;
  @ApiProperty({ description: 'Valor de salidas (S/)' }) salidas!: number;
}

export class ValorTipoDto {
  @ApiProperty({ enum: TipoProducto }) tipo!: TipoProducto;
  @ApiProperty() valor!: number;
}

/** GET /api/v1/logistica/resumen — indicadores del panel. */
export class ResumenLogisticaDto {
  @ApiProperty() valorInventario!: number;
  @ApiProperty() productosActivos!: number;
  @ApiProperty() bajoMinimo!: number;
  @ApiProperty() sinStock!: number;
  @ApiProperty() ocPendientes!: number;
  @ApiProperty() ocPorRecibirValor!: number;
  @ApiProperty() llegadasMes!: number;
  @ApiProperty() salidasMes!: number;
  @ApiProperty({ type: [FlujoDiaDto], description: 'Últimos 14 días' })
  flujo!: FlujoDiaDto[];
  @ApiProperty({ type: [ValorTipoDto] }) porTipo!: ValorTipoDto[];
}
