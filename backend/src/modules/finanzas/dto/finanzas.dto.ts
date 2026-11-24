import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
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

// ─── Clientes y proveedores ──────────────────────────────────────

export class TerceroDto {
  @ApiProperty({ enum: ['RUC', 'DNI', 'CE', 'OTRO'] })
  @IsIn(['RUC', 'DNI', 'CE', 'OTRO'])
  tipoDocumento!: 'RUC' | 'DNI' | 'CE' | 'OTRO';

  @ApiProperty({ example: '20131312955' })
  @Transform(recortar)
  @Matches(/^[A-Z0-9]{6,15}$/i, { message: 'Número de documento inválido' })
  numeroDocumento!: string;

  @ApiProperty({ example: 'Supermercados Peruanos S.A.' })
  @Transform(recortar)
  @IsString()
  @MaxLength(200)
  razonSocial!: string;

  @ApiProperty()
  @IsBoolean()
  esCliente!: boolean;

  @ApiProperty()
  @IsBoolean()
  esProveedor!: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) rubro?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) contacto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) correo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) direccion?: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(0)
  @Max(365)
  diasCredito!: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}

// ─── Comprobantes de venta y compra ──────────────────────────────

export class ComprobanteDto {
  @ApiProperty({ enum: ['venta', 'compra'] })
  @IsIn(['venta', 'compra'])
  operacion!: 'venta' | 'compra';

  @ApiProperty()
  @IsUUID()
  terceroId!: string;

  @ApiProperty({ description: 'Tabla 10 SUNAT: 01 factura, 03 boleta, 07 NC, 08 ND, 02 RxH, 12 ticket, 14 servicios' })
  @IsIn(['01', '03', '07', '08', '02', '12', '14', '00'])
  tipoDoc!: string;

  @ApiProperty({ example: 'F001' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]{1,4}$/, { message: 'Serie: hasta 4 letras o números (ej. F001)' })
  serie!: string;

  @ApiProperty({ example: '125' })
  @Transform(recortar)
  @Matches(/^\d{1,10}$/, { message: 'Número: solo dígitos' })
  numero!: string;

  @ApiProperty({ example: '2026-11-24' }) @IsDateString({ strict: true }) fechaEmision!: string;
  @ApiPropertyOptional({ example: '2026-12-24' }) @IsOptional() @IsDateString({ strict: true }) fechaVencimiento?: string;

  @ApiProperty({ enum: ['PEN', 'USD'] }) @IsIn(['PEN', 'USD']) moneda!: 'PEN' | 'USD';
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(99.999) tipoCambio?: number;

  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999_999) baseGravada!: number;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999_999) noGravada!: number;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999_999) igv!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999_999) retencionRenta?: number;

  @ApiPropertyOptional({ description: 'Detracción (SPOT): 0, 4, 10, 12…' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  detraccionPorcentaje?: number;

  @ApiProperty({ example: '7041', description: 'Ventas: cuenta 70/75. Compras: cuenta de gasto o activo' })
  @Matches(/^\d{3,8}$/)
  cuentaContable!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) glosa?: string;

  @ApiPropertyOptional({ description: 'Nota de crédito: comprobante que corrige' })
  @IsOptional()
  @IsUUID()
  referenciaId?: string;
}

export class AnularDto {
  @ApiProperty({ example: 'Error en el importe' })
  @Transform(recortar)
  @IsString()
  @MinLength(3, { message: 'Escribe el motivo de la anulación' })
  @MaxLength(300)
  motivo!: string;
}

// ─── Caja y bancos ───────────────────────────────────────────────

export class CuentaDto {
  @ApiProperty({ example: 'BCP Soles' }) @Transform(recortar) @IsString() @MaxLength(80) nombre!: string;
  @ApiProperty({ enum: ['caja', 'banco', 'detracciones'] }) @IsIn(['caja', 'banco', 'detracciones']) tipo!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) banco?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) numero?: string;
  @ApiProperty({ enum: ['PEN', 'USD'] }) @IsIn(['PEN', 'USD']) moneda!: string;
  @ApiPropertyOptional({ example: '1041' }) @IsOptional() @Matches(/^10\d{1,6}$/) cuentaContable?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activa?: boolean;
}

export class MovimientoDto {
  @ApiProperty() @IsUUID() cuentaId!: string;
  @ApiProperty({ example: '2026-11-24' }) @IsDateString({ strict: true }) fecha!: string;

  @ApiProperty({ enum: ['cobro', 'pago', 'ingreso', 'egreso', 'transferencia'] })
  @IsIn(['cobro', 'pago', 'ingreso', 'egreso', 'transferencia'])
  tipo!: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() comprobanteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() cuentaDestinoId?: string;
  @ApiPropertyOptional({ example: '5011' }) @IsOptional() @Matches(/^\d{3,8}$/) contrapartida?: string;

  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9_999_999_999) monto!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(99.999) tipoCambio?: number;

  @ApiProperty({ enum: ['efectivo', 'transferencia', 'deposito', 'cheque', 'tarjeta', 'yape_plin', 'otro'] })
  @IsIn(['efectivo', 'transferencia', 'deposito', 'cheque', 'tarjeta', 'yape_plin', 'otro'])
  medio!: string;

  @ApiPropertyOptional({ description: 'N.° de operación bancaria' }) @IsOptional() @IsString() @MaxLength(40) referencia?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) glosa?: string;
}
