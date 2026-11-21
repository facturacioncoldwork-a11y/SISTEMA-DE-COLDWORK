import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MotivoSalida, type FilaSalida } from '../entities/documento.entity.js';
import { linea, LineaDocumentoDto, totalLineas } from './llegada.dto.js';

export class ItemSalidaDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productoId!: string;
  @ApiProperty({ example: 2 }) @IsNumber() @IsPositive() cantidad!: number;
}

/** Body de POST /api/v1/logistica/salidas */
export class CrearSalidaDto {
  @ApiProperty({ format: 'uuid', description: 'Almacén de donde sale' })
  @IsUUID()
  almacenId!: string;
  @ApiProperty({ enum: MotivoSalida })
  @IsEnum(MotivoSalida, { message: 'Motivo inválido' })
  motivo!: MotivoSalida;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Obligatorio si el motivo es transferencia',
  })
  @ValidateIf((o: CrearSalidaDto) => o.motivo === MotivoSalida.Transferencia)
  @IsUUID('all', { message: 'Elige el almacén destino' })
  almacenDestinoId?: string;

  @ApiPropertyOptional({ example: 'Supermercado Vea – Cámara 3' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  destino?: string;
  @ApiPropertyOptional({ example: 'Carlos Ramos (técnico)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsable?: string;
  @ApiPropertyOptional({ example: 'OS-000231' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referencia?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;

  @ApiProperty({ type: [ItemSalidaDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => ItemSalidaDto)
  items!: ItemSalidaDto[];
}

/** Body de PATCH /api/v1/logistica/salidas/:id — solo datos del documento. */
export class ActualizarSalidaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  destino?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsable?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referencia?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class SalidaDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'SA-000034' }) codigo!: string;
  @ApiProperty() fecha!: string;
  @ApiProperty({ enum: MotivoSalida }) motivo!: MotivoSalida;
  @ApiProperty() almacen!: { id: string; nombre: string };
  @ApiPropertyOptional({ nullable: true }) almacenDestino!: {
    id: string;
    nombre: string;
  } | null;
  @ApiPropertyOptional({ nullable: true, type: String }) destino!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) responsable!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) referencia!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) notas!: string | null;
  @ApiProperty({ type: [LineaDocumentoDto] }) lineas!: LineaDocumentoDto[];
  @ApiProperty({ description: 'Valor al costo promedio' }) total!: number;

  static desde(f: FilaSalida): SalidaDto {
    // En transferencias el kardex tiene la salida (origen) y la entrada (destino): se muestra solo la salida
    const lineas = (f.lineas ?? [])
      .filter((l) => l.tipo === 'salida')
      .map(linea);
    return {
      id: f.id,
      codigo: `SA-${String(f.numero).padStart(6, '0')}`,
      fecha: f.fecha,
      motivo: f.motivo,
      almacen: { id: f.almacen?.id ?? '', nombre: f.almacen?.nombre ?? '' },
      almacenDestino: f.almacen_destino
        ? { id: f.almacen_destino.id, nombre: f.almacen_destino.nombre }
        : null,
      destino: f.destino,
      responsable: f.responsable,
      referencia: f.referencia,
      notas: f.notas,
      lineas,
      total: totalLineas(lineas),
    };
  }
}
