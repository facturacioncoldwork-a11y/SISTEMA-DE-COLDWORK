import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ACCIONES_ESTADO,
  ORIGENES_ASIENTO,
  type AccionEstado,
  type OrigenAsiento,
} from '../entities/contabilidad.entity.js';

// ─── Partes del asiento ──────────────────────────────────────────

export class LineaDto {
  @ApiProperty({ example: '1212' })
  @Matches(/^\d{3,8}$/, { message: 'Cuenta inválida (3 a 8 dígitos del PCGE)' })
  cuenta!: string;

  @ApiProperty({ example: 1180 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999_999)
  debe!: number;

  @ApiProperty({ example: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999_999)
  haber!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  glosa?: string;
}

/** Comprobante que sustenta la operación (Tabla 10 de SUNAT). */
export class DocumentoDto {
  @ApiProperty({ example: '01' })
  @Matches(/^\d{2}$/)
  tipo!: string;

  @ApiProperty({ example: 'F001' })
  @IsString()
  @MaxLength(20)
  serie!: string;

  @ApiProperty({ example: '125' })
  @IsString()
  @MaxLength(20)
  numero!: string;

  @ApiPropertyOptional({ example: '20123456789' })
  @IsOptional()
  @Matches(/^(\d{8}|\d{11})?$/, { message: 'RUC de 11 dígitos o DNI de 8' })
  documentoTercero?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombreTercero?: string;
}

/** Foto o PDF ya subido al almacenamiento privado (solo se guarda su ruta). */
export class AdjuntoDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  nombre!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  tipo!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(5 * 1024 * 1024)
  tamano!: number;

  @ApiProperty({ description: 'Ruta en el almacenamiento: {empresa}/{carpeta}/{archivo}' })
  @Matches(/^[0-9a-f-]{36}\/[\w-]+\/[^/]+$/, { message: 'Ruta de archivo inválida' })
  ruta!: string;
}

export class DatosAsientoDto {
  @ApiProperty({ example: '2026-11-21' })
  @IsDateString({ strict: true })
  fecha!: string;

  @ApiProperty({ enum: ORIGENES_ASIENTO })
  @IsIn(ORIGENES_ASIENTO)
  origen!: OrigenAsiento;

  @ApiProperty({ example: 'Mantenimiento de cámara frigorífica' })
  @IsString()
  @MaxLength(300)
  glosa!: string;

  @ApiProperty({ enum: ['PEN', 'USD'] })
  @IsIn(['PEN', 'USD'])
  moneda!: 'PEN' | 'USD';

  @ApiPropertyOptional({ example: 3.75 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  tipoCambio?: number;

  @ApiPropertyOptional({ type: DocumentoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentoDto)
  documento?: DocumentoDto;

  @ApiPropertyOptional({ type: [AdjuntoDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => AdjuntoDto)
  adjuntos?: AdjuntoDto[];

  @ApiProperty({ type: [LineaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LineaDto)
  lineas!: LineaDto[];
}

// ─── Bodies de los endpoints ─────────────────────────────────────

/** POST /contabilidad/asientos y PATCH /contabilidad/asientos/:id */
export class GuardarAsientoDto {
  @ApiProperty({ type: DatosAsientoDto })
  @ValidateNested()
  @Type(() => DatosAsientoDto)
  datos!: DatosAsientoDto;

  @ApiProperty({ description: 'true = registrar o enviar a aprobación; false = borrador' })
  @IsBoolean()
  confirmar!: boolean;
}

/** POST /contabilidad/asientos/:id/estado */
export class CambiarEstadoDto {
  @ApiProperty({ enum: ACCIONES_ESTADO })
  @IsIn(ACCIONES_ESTADO)
  accion!: AccionEstado;

  @ApiPropertyOptional({ description: 'Obligatorio al observar' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}

/** PUT /contabilidad/config */
export class ConfigContableDto {
  @ApiProperty({ enum: ['rmt', 'general', 'rer'] })
  @IsIn(['rmt', 'general', 'rer'])
  regimen!: string;

  @ApiProperty({ enum: ['hasta300', 'hasta500', 'hasta1700', 'mas1700'] })
  @IsIn(['hasta300', 'hasta500', 'hasta1700', 'mas1700'])
  tramo!: string;

  @ApiProperty()
  @IsBoolean()
  contadorRegistraDirecto!: boolean;

  @ApiProperty()
  @IsBoolean()
  contadorVeLibros!: boolean;
}
