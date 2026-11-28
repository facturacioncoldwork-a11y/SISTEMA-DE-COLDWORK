import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Vacío, o 20 dígitos con guiones o espacios opcionales (como lo escriben los bancos). */
const CCI = /^$|^(?=(?:[^0-9]*[0-9]){20}[^0-9]*$)[0-9 -]+$/;

const recortar =({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Cuenta bancaria de la empresa (sale en las cotizaciones). */
export class CuentaBancariaDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(60) @Transform(recortar) banco!: string;
  @ApiProperty({ enum: ['PEN', 'USD'] }) @IsIn(['PEN', 'USD']) moneda!: 'PEN' | 'USD';
  @ApiProperty() @Matches(/^[0-9][0-9 -]{4,28}[0-9]$/, { message: 'Número de cuenta inválido' }) @Transform(recortar) numero!: string;
  @ApiProperty() @Matches(CCI, { message: 'El CCI tiene 20 dígitos' }) @Transform(recortar) cci!: string;
}

/** Cuenta de detracciones (Banco de la Nación). Vacía si no se usa. */
export class CuentaDetraccionDto {
  @ApiProperty() @Matches(/^$|^[0-9][0-9 -]{4,28}[0-9]$/, { message: 'Número de cuenta de detracciones inválido' }) @Transform(recortar) numero!: string;
  @ApiProperty() @Matches(CCI, { message: 'El CCI tiene 20 dígitos' }) @Transform(recortar) cci!: string;
}

/** Configuración que ajusta el dueño o un administrador. */
export class ConfigEmpresaDto {
  @ApiProperty() @IsString() @MaxLength(30) @Transform(recortar) telefono!: string;
  @ApiProperty() @ValidateIf((o: ConfigEmpresaDto) => o.correo !== '') @IsEmail() @MaxLength(120) @Transform(recortar) correo!: string;
  @ApiProperty() @IsString() @MaxLength(120) @Transform(recortar) web!: string;
  @ApiProperty() @ValidateIf((o: ConfigEmpresaDto) => o.correoOrdenes !== '') @IsEmail() @MaxLength(120) @Transform(recortar) correoOrdenes!: string;

  @ApiProperty({ type: [CuentaBancariaDto] })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CuentaBancariaDto)
  cuentas!: CuentaBancariaDto[];

  @ApiProperty({ type: CuentaDetraccionDto })
  @ValidateNested()
  @Type(() => CuentaDetraccionDto)
  cuentaDetraccion!: CuentaDetraccionDto;

  @ApiProperty({ example: 'COT-' }) @Matches(/^[A-Z0-9-]{1,8}$/, { message: 'Prefijo: solo mayúsculas, números y guion (máx. 8)' }) cotPrefijo!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(365) cotValidezProy!: number;
  @ApiProperty() @IsInt() @Min(1) @Max(365) cotValidezServ!: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(100) cotDetraccion!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) cotNotas!: string;
}
