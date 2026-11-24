import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  TipoProducto,
  type FilaProductoStock,
  type LoteEntity,
  type MovimientoEntity,
} from '../entities/producto.entity.js';

const mayus = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** Body de POST /api/v1/logistica/productos */
export class CrearProductoDto {
  @ApiProperty({ example: 'GAS-R410A-11' })
  @Transform(mayus)
  @Matches(/^[A-Z0-9._-]{2,30}$/, {
    message: 'SKU: 2 a 30 letras, números, punto o guion',
  })
  sku!: string;

  @ApiProperty({ example: 'Gas refrigerante R-410A 11.3 kg' })
  @IsString()
  @MaxLength(160)
  nombre!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiProperty({ enum: TipoProducto })
  @IsEnum(TipoProducto, { message: 'Tipo inválido' })
  tipo!: TipoProducto;

  @ApiPropertyOptional({ example: 'Chemours' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  marca?: string;

  @ApiProperty({
    example: 'BAL',
    description: 'UND, KG, M, LT, BAL (balón), JGO…',
  })
  @Transform(mayus)
  @IsString()
  @MaxLength(10)
  unidad!: string;

  @ApiProperty({ example: 5 }) @IsNumber() @Min(0) stockMinimo!: number;
}

/** Body de PATCH /api/v1/logistica/productos/:id */
export class ActualizarProductoDto extends PartialType(CrearProductoDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}

export class StockAlmacenDto {
  @ApiProperty({ format: 'uuid' }) almacenId!: string;
  @ApiProperty() cantidad!: number;
}

/** Parte del stock que vino de una llegada (para saber cuánto tiempo lleva). */
export class LoteDto {
  @ApiProperty({ format: 'uuid' }) llegadaId!: string;
  @ApiProperty({ example: 'LL-000012' }) documento!: string;
  @ApiProperty({ description: 'Fecha en que llegó (fecha de ingreso)' })
  fecha!: string;
  @ApiProperty({ description: 'Cuánto de esa llegada sigue en almacén' })
  cantidad!: number;
  @ApiProperty({ description: 'Costo unitario de esa llegada (S/)' })
  costoUnitario!: number;

  static desde(l: LoteEntity): LoteDto {
    return {
      llegadaId: l.llegada_id,
      documento: `LL-${String(l.llegada_numero).padStart(6, '0')}`,
      fecha: l.fecha,
      cantidad: Number(l.cantidad),
      costoUnitario: Number(l.costo_unitario),
    };
  }
}

/** Producto con su stock total y por almacén. */
export class ProductoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() nombre!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) descripcion!:
    string | null;
  @ApiProperty({ enum: TipoProducto }) tipo!: TipoProducto;
  @ApiPropertyOptional({ nullable: true, type: String }) marca!: string | null;
  @ApiProperty() unidad!: string;
  @ApiProperty() stockMinimo!: number;
  @ApiProperty({ description: 'Costo promedio ponderado (S/)' })
  costoPromedio!: number;
  @ApiProperty() stockTotal!: number;
  @ApiProperty({ description: 'stockTotal × costoPromedio' })
  valorizado!: number;
  @ApiProperty({ type: [StockAlmacenDto] }) stock!: StockAlmacenDto[];
  @ApiProperty() activo!: boolean;
  @ApiProperty({
    type: [LoteDto],
    description:
      'Stock actual por fecha de ingreso, del más antiguo al más reciente',
  })
  lotes!: LoteDto[];
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      'Fecha de ingreso de lo más antiguo que queda (null si no hay stock)',
  })
  ingresoMasAntiguo!: string | null;

  static desde(
    f: FilaProductoStock,
    filasLotes: LoteEntity[] = [],
  ): ProductoDto {
    const lotes = filasLotes
      .map((l) => LoteDto.desde(l))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const stock = (f.stock ?? []).map((s) => ({
      almacenId: s.almacen_id,
      cantidad: Number(s.cantidad),
    }));
    const stockTotal = stock.reduce((t, s) => t + s.cantidad, 0);
    return {
      id: f.id,
      sku: f.sku,
      nombre: f.nombre,
      descripcion: f.descripcion,
      tipo: f.tipo,
      marca: f.marca,
      unidad: f.unidad,
      stockMinimo: Number(f.stock_minimo),
      costoPromedio: Number(f.costo_promedio),
      stockTotal,
      valorizado: Math.round(stockTotal * Number(f.costo_promedio) * 100) / 100,
      stock,
      activo: f.activo,
      lotes,
      ingresoMasAntiguo: lotes[0]?.fecha ?? null,
    };
  }
}

/** Línea del kardex de un producto. */
export class MovimientoDto {
  @ApiProperty() id!: number;
  @ApiProperty() fecha!: string;
  @ApiProperty({ enum: ['entrada', 'salida'] }) tipo!: 'entrada' | 'salida';
  @ApiProperty({ format: 'uuid' }) almacenId!: string;
  @ApiProperty() cantidad!: number;
  @ApiProperty() costoUnitario!: number;
  @ApiProperty({ description: 'Stock del almacén después del movimiento' })
  saldo!: number;
  @ApiProperty({ description: 'LL-000012 / SA-000034' }) documento!: string;
  @ApiProperty({ description: 'Proveedor, destino o técnico' })
  detalle!: string;

  static desde(m: MovimientoEntity): MovimientoDto {
    const doc = m.llegada
      ? `LL-${String(m.llegada.numero).padStart(6, '0')}`
      : m.salida
        ? `SA-${String(m.salida.numero).padStart(6, '0')}`
        : '—';
    const detalle = m.llegada
      ? (m.llegada.proveedor?.razon_social ?? 'Ingreso sin proveedor')
      : [m.salida?.destino, m.salida?.responsable]
          .filter(Boolean)
          .join(' · ') ||
        (m.salida?.motivo ?? '');
    return {
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
      almacenId: m.almacen_id,
      cantidad: Number(m.cantidad),
      costoUnitario: Number(m.costo_unitario),
      saldo: Number(m.saldo),
      documento: doc,
      detalle,
    };
  }
}
