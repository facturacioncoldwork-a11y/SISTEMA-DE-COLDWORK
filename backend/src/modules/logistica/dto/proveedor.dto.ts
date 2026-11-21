import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { TerceroEntity } from '../entities/tercero.entity.js';

const TIPOS_DOC = ['RUC', 'DNI', 'CE', 'OTRO'] as const;

/** Body de POST /api/v1/logistica/proveedores */
export class CrearProveedorDto {
  @ApiProperty({ enum: TIPOS_DOC, example: 'RUC' })
  @IsIn(TIPOS_DOC)
  tipoDocumento!: (typeof TIPOS_DOC)[number];

  @ApiProperty({ example: '20512345678' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Matches(/^[0-9A-Z]{6,15}$/, { message: 'Número de documento inválido' })
  numeroDocumento!: string;

  @ApiProperty({ example: 'Refrigeración Andina S.A.C.' })
  @IsString()
  @MaxLength(200)
  razonSocial!: string;
  @ApiPropertyOptional({ example: 'Gases y compresores' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  rubro?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contacto?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Correo inválido' })
  correo?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;
  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  diasCredito?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  calificacion?: number;
}

export class ActualizarProveedorDto extends PartialType(CrearProveedorDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}

export class ProveedorDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() tipoDocumento!: string;
  @ApiProperty() numeroDocumento!: string;
  @ApiProperty() razonSocial!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) rubro!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) contacto!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) telefono!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) correo!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) direccion!:
    string | null;
  @ApiProperty() diasCredito!: number;
  @ApiPropertyOptional({ nullable: true, type: Number }) calificacion!:
    number | null;
  @ApiProperty() activo!: boolean;

  static desde(t: TerceroEntity): ProveedorDto {
    return {
      id: t.id,
      tipoDocumento: t.tipo_documento,
      numeroDocumento: t.numero_documento,
      razonSocial: t.razon_social,
      rubro: t.rubro,
      contacto: t.contacto,
      telefono: t.telefono,
      correo: t.correo,
      direccion: t.direccion,
      diasCredito: t.dias_credito,
      calificacion: t.calificacion,
      activo: t.activo,
    };
  }
}
