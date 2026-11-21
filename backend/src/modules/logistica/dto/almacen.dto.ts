import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { TipoAlmacen, type AlmacenEntity } from '../entities/almacen.entity.js';

/** Body de POST /api/v1/logistica/almacenes */
export class CrearAlmacenDto {
  @ApiProperty({ example: 'ALM-01' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9-]{2,12}$/, {
    message: 'Código: 2 a 12 letras, números o guion',
  })
  codigo!: string;

  @ApiProperty({ example: 'Almacén central Lima' })
  @IsString()
  @MaxLength(120)
  nombre!: string;

  @ApiProperty({
    enum: TipoAlmacen,
    description: 'principal, movil (unidad de un técnico) u obra',
  })
  @IsEnum(TipoAlmacen, { message: 'Tipo inválido' })
  tipo!: TipoAlmacen;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsable?: string;
}

export class ActualizarAlmacenDto extends PartialType(CrearAlmacenDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}

export class AlmacenDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() codigo!: string;
  @ApiProperty() nombre!: string;
  @ApiProperty({ enum: TipoAlmacen }) tipo!: TipoAlmacen;
  @ApiPropertyOptional({ nullable: true, type: String }) direccion!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) responsable!:
    string | null;
  @ApiProperty() activo!: boolean;
  @ApiProperty({ description: 'Productos distintos con stock' })
  productos!: number;
  @ApiProperty({ description: 'Valor del stock del almacén (S/)' })
  valorizado!: number;

  static desde(a: AlmacenEntity, productos = 0, valorizado = 0): AlmacenDto {
    return {
      id: a.id,
      codigo: a.codigo,
      nombre: a.nombre,
      tipo: a.tipo,
      direccion: a.direccion,
      responsable: a.responsable,
      activo: a.activo,
      productos,
      valorizado: Math.round(valorizado * 100) / 100,
    };
  }
}
