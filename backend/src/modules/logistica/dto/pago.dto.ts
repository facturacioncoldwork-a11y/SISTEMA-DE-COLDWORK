import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { FilaPago } from '../entities/pago.entity.js';
import { OrdenCompraDto } from './orden-compra.dto.js';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Body de POST /api/v1/logistica/pagos (una cuota). Solo el dueño. */
export class CrearPagoDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() ordenId!: string;

  @ApiProperty({ example: 'Adelanto 50 %' })
  @Transform(recortar)
  @IsString()
  @MinLength(2, { message: 'Escribe el concepto (ej. Adelanto, Saldo)' })
  @MaxLength(60)
  concepto!: string;

  @ApiPropertyOptional({ example: 50, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  porcentaje?: number | null;

  @ApiProperty({
    example: 6460.5,
    description: 'En la moneda de la orden de compra',
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Monto inválido (máximo 2 decimales)' },
  )
  @Min(0.01, { message: 'El monto debe ser mayor que cero' })
  monto!: number;

  @ApiProperty({
    example: '2026-10-08',
    description: 'Hasta cuándo hay que pagar',
  })
  @IsDateString()
  vence!: string;

  @ApiPropertyOptional({
    example: 0,
    nullable: true,
    description:
      'Vence N días después de que llega el equipo (0 = al llegar). Al recibirse la OC, `vence` se fija con la fecha real.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  diasTrasLlegada?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(500)
  notas?: string;
}

/** Body de PATCH /api/v1/logistica/pagos/:id */
export class ActualizarPagoDto extends PartialType(
  OmitType(CrearPagoDto, ['ordenId'] as const),
) {}

/** Body de POST /api/v1/logistica/pagos/:id/pagar */
export class PagarDto {
  @ApiProperty({ example: '2026-10-08' }) @IsDateString() pagadoEn!: string;

  @ApiPropertyOptional({
    example: 'OP 778812',
    description: 'N° de operación o voucher',
  })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(80)
  referencia?: string;
}

export class PagoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) ordenId!: string;
  @ApiProperty() concepto!: string;
  @ApiPropertyOptional({ nullable: true, type: Number }) porcentaje!:
    number | null;
  @ApiProperty() monto!: number;
  @ApiProperty() vence!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) pagadoEn!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) referencia!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) notas!: string | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) diasTrasLlegada!:
    number | null;

  static desde(f: FilaPago): PagoDto {
    return {
      id: f.id,
      ordenId: f.orden_id,
      concepto: f.concepto,
      porcentaje: f.porcentaje === null ? null : Number(f.porcentaje),
      monto: Number(f.monto),
      vence: f.vence,
      pagadoEn: f.pagado_en,
      referencia: f.referencia,
      notas: f.notas,
      diasTrasLlegada: f.dias_tras_llegada ?? null,
    };
  }
}

/** Orden de compra con su plan de pagos (GET /api/v1/logistica/pagos). */
export class OrdenConPagosDto extends OrdenCompraDto {
  @ApiProperty({ type: [PagoDto] }) pagos!: PagoDto[];
  @ApiProperty({ description: 'Ya pagado (moneda de la OC)' }) pagado!: number;
  @ApiProperty({ description: 'Falta pagar según el plan' }) pendiente!: number;
  @ApiProperty({
    description: 'Total de la OC que aún no tiene cuota en el plan',
  })
  sinPlan!: number;
}
