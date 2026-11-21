import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDateString,
  IsIn,
  ValidateIf,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { FilaLlegada } from '../entities/documento.entity.js';
import { codigoOc } from '../entities/orden-compra.entity.js';

export class ItemLlegadaDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productoId!: string;
  @ApiProperty({ example: 4 }) @IsNumber() @IsPositive() cantidad!: number;
  @ApiProperty({ example: 380.5 }) @IsNumber() @Min(0) costoUnitario!: number;
}

/** Body de POST /api/v1/logistica/llegadas */
export class CrearLlegadaDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() almacenId!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Si viene de una OC, el proveedor sale de ahí',
  })
  @IsOptional()
  @IsUUID()
  ordenId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;
  @ApiPropertyOptional({ example: 'T001-004512' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  guiaRemision?: string;
  @ApiPropertyOptional({ example: 'F001-00981' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  comprobante?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;

  @ApiPropertyOptional({
    example: '2026-11-20T10:30:00-05:00',
    description: 'Cuándo llegó de verdad (por defecto: ahora)',
  })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiPropertyOptional({
    enum: ['PEN', 'USD'],
    description: 'Moneda de la OC; los costos de items van YA en soles',
  })
  @IsOptional()
  @IsIn(['PEN', 'USD'])
  moneda?: 'PEN' | 'USD';

  @ApiPropertyOptional({
    example: 3.75,
    description: 'Obligatorio si moneda = USD',
  })
  @ValidateIf((o: CrearLlegadaDto) => o.moneda === 'USD')
  @IsNumber({}, { message: 'Indica el tipo de cambio' })
  @IsPositive({ message: 'El tipo de cambio debe ser mayor a 0' })
  tipoCambio?: number;

  @ApiProperty({ type: [ItemLlegadaDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => ItemLlegadaDto)
  items!: ItemLlegadaDto[];
}

/** Body de PATCH /api/v1/logistica/llegadas/:id — solo datos del documento (las cantidades no se editan: se elimina y se registra de nuevo). */
export class ActualizarLlegadaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  guiaRemision?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  comprobante?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fecha?: string;
}

export class LineaDocumentoDto {
  @ApiProperty({ format: 'uuid' }) productoId!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() nombre!: string;
  @ApiProperty() unidad!: string;
  @ApiProperty() cantidad!: number;
  @ApiProperty() costoUnitario!: number;
}

export class LlegadaDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'LL-000012' }) codigo!: string;
  @ApiProperty() fecha!: string;
  @ApiProperty() almacen!: { id: string; nombre: string };
  @ApiPropertyOptional({ nullable: true }) proveedor!: {
    id: string;
    razonSocial: string;
  } | null;
  @ApiPropertyOptional({ nullable: true }) orden!: {
    id: string;
    codigo: string;
  } | null;
  @ApiPropertyOptional({ nullable: true, type: String }) guiaRemision!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) comprobante!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) notas!: string | null;
  @ApiProperty({ enum: ['PEN', 'USD'] }) moneda!: 'PEN' | 'USD';
  @ApiPropertyOptional({ nullable: true, type: Number }) tipoCambio!:
    number | null;
  @ApiProperty({ type: [LineaDocumentoDto] }) lineas!: LineaDocumentoDto[];
  @ApiProperty() total!: number;

  static desde(f: FilaLlegada): LlegadaDto {
    const lineas = (f.lineas ?? []).map(linea);
    return {
      id: f.id,
      codigo: `LL-${String(f.numero).padStart(6, '0')}`,
      fecha: f.fecha,
      almacen: { id: f.almacen?.id ?? '', nombre: f.almacen?.nombre ?? '' },
      proveedor: f.proveedor
        ? { id: f.proveedor.id, razonSocial: f.proveedor.razon_social }
        : null,
      orden: f.orden
        ? {
            id: f.orden.id,
            codigo: codigoOc(f.orden.numero, f.orden.fecha),
          }
        : null,
      moneda: f.moneda ?? 'PEN',
      tipoCambio: f.tipo_cambio == null ? null : Number(f.tipo_cambio),
      guiaRemision: f.guia_remision,
      comprobante: f.comprobante,
      notas: f.notas,
      lineas,
      total: totalLineas(lineas),
    };
  }
}

export function linea(l: FilaLlegada['lineas'][number]): LineaDocumentoDto {
  return {
    productoId: l.producto_id,
    sku: l.producto?.sku ?? '',
    nombre: l.producto?.nombre ?? '',
    unidad: l.producto?.unidad ?? '',
    cantidad: Number(l.cantidad),
    costoUnitario: Number(l.costo_unitario),
  };
}

export function totalLineas(lineas: LineaDocumentoDto[]): number {
  return (
    lineas.reduce(
      (t, l) => t + Math.round(l.cantidad * l.costoUnitario * 100),
      0,
    ) / 100
  );
}
