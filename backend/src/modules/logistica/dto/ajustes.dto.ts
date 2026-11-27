import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';

/** Body de PUT /api/v1/logistica/ajustes (solo dueño o admin). Solo se cambia lo que se envía. */
export class GuardarAjustesLogisticaDto {
  @ApiPropertyOptional({
    example: 24,
    minimum: 3,
    maximum: 120,
    description:
      'Meses en almacén desde los que un producto se marca como antiguo',
  })
  @IsOptional()
  @IsInt({ message: 'Indica los meses como número entero' })
  @Min(3, { message: 'Mínimo 3 meses' })
  @Max(120, { message: 'Máximo 120 meses (10 años)' })
  mesesAntiguedad?: number;

  @ApiPropertyOptional({
    example: 3.75,
    nullable: true,
    description:
      'Tipo de cambio referencial (S/ por US$) para compras en otra moneda',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'Tipo de cambio inválido' })
  @IsPositive({ message: 'El tipo de cambio debe ser mayor a 0' })
  tipoCambioRef?: number | null;
}

/** Body de POST /api/v1/logistica/ajustes/moneda (solo el dueño). */
export class CambiarMonedaDto {
  @ApiProperty({ enum: ['PEN', 'USD'] })
  @IsIn(['PEN', 'USD'], { message: 'Moneda inválida' })
  moneda!: 'PEN' | 'USD';

  @ApiPropertyOptional({
    example: 3.75,
    description:
      'S/ por US$ para convertir los costos ya registrados (obligatorio si hay costos)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'Tipo de cambio inválido' })
  @IsPositive({ message: 'El tipo de cambio debe ser mayor a 0' })
  tipoCambio?: number;
}

/** Ajustes de logística de la empresa. */
export class AjustesLogisticaDto {
  @ApiProperty({ example: 24 }) mesesAntiguedad!: number;
  @ApiProperty({ enum: ['PEN', 'USD'], description: 'Moneda del inventario' })
  moneda!: 'PEN' | 'USD';
  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'S/ por US$',
  })
  tipoCambioRef!: number | null;
}
