import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * Documento (cotización, servicio u orden). La forma la valida la base de datos; aquí solo
 * que sea un objeto y la versión (dos personas no se pisan los cambios).
 */
export class GuardarDocumentoDto {
  @ApiProperty({ type: Object }) @IsObject() datos!: Record<string, unknown>;
  @ApiProperty() @IsInt() @Min(0) @Max(1_000_000) version!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) @Transform(recortar) nota?: string;
}

export class GuardarEquipoDto {
  @ApiProperty({ type: Object }) @IsObject() datos!: Record<string, unknown>;
}

export class EstadoCotizacionDto {
  @ApiProperty({ enum: ['borrador', 'enviada', 'rechazada'] })
  @IsIn(['borrador', 'enviada', 'rechazada'])
  estado!: 'borrador' | 'enviada' | 'rechazada';

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) @Transform(recortar) motivo?: string;
}

export class AprobarCotizacionDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(60) @Transform(recortar) ordenCliente!: string;
  @ApiProperty() @IsUUID() expedienteId!: string;
  @ApiProperty({ type: Object }) @IsObject() expediente!: Record<string, unknown>;
}

export class MensajeDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) @Transform(recortar) texto!: string;
}
