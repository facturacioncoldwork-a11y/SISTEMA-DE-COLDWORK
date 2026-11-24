import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

/** Body de PUT /api/v1/logistica/ajustes (solo dueño o admin). */
export class GuardarAjustesLogisticaDto {
  @ApiProperty({
    example: 24,
    minimum: 3,
    maximum: 120,
    description:
      'Meses en almacén desde los que un producto se marca como antiguo',
  })
  @IsInt({ message: 'Indica los meses como número entero' })
  @Min(3, { message: 'Mínimo 3 meses' })
  @Max(120, { message: 'Máximo 120 meses (10 años)' })
  mesesAntiguedad!: number;
}

/** Ajustes de logística de la empresa. */
export class AjustesLogisticaDto {
  @ApiProperty({ example: 24 }) mesesAntiguedad!: number;
}
