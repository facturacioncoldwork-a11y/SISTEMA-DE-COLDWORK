import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Marca propia: la hora la pone el servidor (salvo "declarada", que la aprueba el supervisor). */
export class MarcarDto {
  @ApiProperty({ enum: ['gps', 'codigo', 'declarada'] })
  @IsIn(['gps', 'codigo', 'declarada'])
  metodo!: 'gps' | 'codigo' | 'declarada';

  @ApiPropertyOptional() @IsOptional() @IsLatitude() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() lng?: number;

  @ApiPropertyOptional({ example: '482913' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'El código tiene 6 dígitos' })
  codigo?: string;

  @ApiPropertyOptional({ example: '17:40', description: 'Solo para "declarada"' })
  @IsOptional()
  @Matches(HORA, { message: 'Hora inválida (HH:MM)' })
  hora?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(recortar) @IsString() @MaxLength(300) motivo?: string;
}

/** Marca registrada por el supervisor para un trabajador (ahora mismo). */
export class MarcaManualDto {
  @ApiProperty() @IsUUID() usuarioId!: string;

  @ApiProperty({ example: 'Celular sin batería' })
  @Transform(recortar)
  @IsString()
  @MinLength(5, { message: 'Escribe el motivo (queda registrado)' })
  @MaxLength(300)
  motivo!: string;
}

export class HorarioDto {
  @ApiProperty({ example: '08:00' }) @Matches(HORA) entrada!: string;
  @ApiProperty({ example: '17:00' }) @Matches(HORA) salida!: string;
  @ApiProperty({ example: 60 }) @IsInt() @Min(45) @Max(180) refrigerio!: number;
  @ApiProperty({ example: '12:00' }) @Matches(HORA) refrigerioDesde!: string;
  @ApiProperty({ example: '15:00' }) @Matches(HORA) refrigerioHasta!: string;
  @ApiProperty({ example: 10 }) @IsInt() @Min(0) @Max(30) tolerancia!: number;

  @ApiProperty({ example: ['gps', 'codigo', 'manual'] })
  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(['gps', 'codigo', 'manual'], { each: true })
  metodos!: string[];

  @ApiProperty() @IsBoolean() selfie!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() oficinaLat?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() oficinaLng?: number | null;
  @ApiProperty({ example: 150 }) @IsInt() @Min(30) @Max(1000) radioOficina!: number;
}

export class AusenciaDto {
  @ApiProperty() @IsUUID() usuarioId!: string;
  @ApiProperty({ example: '2026-11-25' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha!: string;

  @ApiProperty({ enum: ['descanso_medico', 'vacaciones', 'permiso', 'licencia'] })
  @IsIn(['descanso_medico', 'vacaciones', 'permiso', 'licencia'])
  tipo!: string;

  @ApiPropertyOptional() @IsOptional() @Transform(recortar) @IsString() @MaxLength(300) sustento?: string;
}
