import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  codigoOc,
  EstadoOc,
  type FilaOrdenCompra,
} from '../entities/orden-compra.entity.js';

export const MONEDAS = ['PEN', 'USD'] as const;
export type Moneda = (typeof MONEDAS)[number];

export class ItemOrdenDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() productoId!: string;
  @ApiProperty({ example: 10 }) @IsNumber() @IsPositive() cantidad!: number;
  @ApiProperty({ example: 380.5, description: 'Costo unitario sin IGV (S/)' })
  @IsNumber()
  @Min(0)
  costoUnitario!: number;
}

/** Campos de plazo y seguimiento (comunes a crear y editar). */
class PlazoOrdenDto {
  @ApiPropertyOptional({
    example: '2-3 semanas',
    description: 'Lo que dijo el proveedor (guía, correo o llamada)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  plazoTexto?: string;

  @ApiPropertyOptional({
    example: '2026-12-04',
    description: 'Inicio de la ventana estimada de llegada',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  entregaDesde?: string | null;

  @ApiPropertyOptional({
    example: '2026-12-11',
    description: 'Fin de la ventana (o la fecha exacta)',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  entregaHasta?: string | null;

  @ApiPropertyOptional({ example: 'Supermercados Peruanos – Plaza Vea Surco' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  cliente?: string;

  @ApiPropertyOptional({
    example: '2026-12-15',
    description: 'Fecha prometida al cliente',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  compromisoCliente?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;

  @ApiPropertyOptional({
    enum: MONEDAS,
    description: 'PEN (soles) o USD (dólares)',
  })
  @IsOptional()
  @IsIn(MONEDAS, { message: 'Moneda inválida' })
  moneda?: Moneda;

  @ApiPropertyOptional({ example: 'Factura a 15 días' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  condicionesPago?: string;
  @ApiPropertyOptional({ example: 'Ica' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  lugarEntrega?: string;
  @ApiPropertyOptional({ example: 'Sr. José (ventas)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  atencion?: string;
  @ApiPropertyOptional({ example: 'José Sánchez Solano' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  solicitadoPor?: string;

  @ApiPropertyOptional({
    example: 'HC 1724',
    description: 'N° de la cotización del proveedor',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cotizacionRef?: string;
}

/** Body de POST /api/v1/logistica/ordenes-compra */
export class CrearOrdenCompraDto extends PlazoOrdenDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() proveedorId!: string;
  @ApiProperty({ format: 'uuid', description: 'Almacén donde llegará' })
  @IsUUID()
  almacenId!: string;
  @ApiPropertyOptional({
    description: 'true = se crea ya enviada al proveedor',
  })
  @IsOptional()
  @IsBoolean()
  enviar?: boolean;

  @ApiProperty({ type: [ItemOrdenDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => ItemOrdenDto)
  items!: ItemOrdenDto[];
}

/** Body de PATCH /api/v1/logistica/ordenes-compra/:id — todo opcional. */
export class ActualizarOrdenCompraDto extends PlazoOrdenDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  almacenId?: string;

  @ApiPropertyOptional({
    example: '2026-12-14',
    description: 'Fecha en que se entregó al cliente (null = aún no)',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  entregadoCliente?: string | null;

  @ApiPropertyOptional({
    type: [ItemOrdenDto],
    description: 'Solo en borrador: reemplaza todos los productos',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'La orden debe tener al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => ItemOrdenDto)
  items?: ItemOrdenDto[];
}

export class ItemOrdenRespuestaDto {
  @ApiProperty({ format: 'uuid' }) productoId!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() nombre!: string;
  @ApiProperty() unidad!: string;
  @ApiProperty() cantidad!: number;
  @ApiProperty() cantidadRecibida!: number;
  @ApiProperty() costoUnitario!: number;
  @ApiProperty() subtotal!: number;
}

export class OrdenCompraDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: '2026-0219' }) codigo!: string;
  @ApiProperty({ enum: EstadoOc }) estado!: EstadoOc;
  @ApiProperty() fecha!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) plazoTexto!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) entregaDesde!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) entregaHasta!:
    string | null;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Se llena al completar la recepción',
  })
  fechaLlegadaReal!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) cliente!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) compromisoCliente!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) entregadoCliente!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) notas!: string | null;
  @ApiProperty({ enum: MONEDAS }) moneda!: Moneda;
  @ApiPropertyOptional({ nullable: true, type: String }) condicionesPago!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) lugarEntrega!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) atencion!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) solicitadoPor!:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) cotizacionRef!:
    string | null;
  @ApiProperty() proveedor!: {
    id: string;
    razonSocial: string;
    numeroDocumento: string;
    direccion: string | null;
  };
  @ApiProperty() almacen!: { id: string; nombre: string };
  @ApiProperty({ type: [ItemOrdenRespuestaDto] })
  items!: ItemOrdenRespuestaDto[];
  @ApiProperty({ description: 'Valor de venta sin IGV' }) subtotal!: number;
  @ApiProperty() igv!: number;
  @ApiProperty() total!: number;
  @ApiProperty({ description: '0 a 100' }) avance!: number;

  static desde(f: FilaOrdenCompra): OrdenCompraDto {
    const items = (f.items ?? []).map((i) => ({
      productoId: i.producto_id,
      sku: i.producto?.sku ?? '',
      nombre: i.producto?.nombre ?? '',
      unidad: i.producto?.unidad ?? '',
      cantidad: Number(i.cantidad),
      cantidadRecibida: Number(i.cantidad_recibida),
      costoUnitario: Number(i.costo_unitario),
      subtotal:
        Math.round(Number(i.cantidad) * Number(i.costo_unitario) * 100) / 100,
    }));
    // En céntimos para no arrastrar errores de coma flotante
    const base = items.reduce((t, i) => t + Math.round(i.subtotal * 100), 0);
    const igv = Math.round(base * 0.18);
    const pedido = items.reduce((t, i) => t + i.cantidad, 0);
    const recibido = items.reduce(
      (t, i) => t + Math.min(i.cantidadRecibida, i.cantidad),
      0,
    );
    return {
      id: f.id,
      codigo: codigoOc(f.numero, f.fecha),
      estado: f.estado,
      fecha: f.fecha,
      plazoTexto: f.plazo_texto,
      entregaDesde: f.entrega_desde,
      entregaHasta: f.entrega_hasta,
      fechaLlegadaReal: f.fecha_llegada_real,
      cliente: f.cliente,
      compromisoCliente: f.compromiso_cliente,
      entregadoCliente: f.entregado_cliente,
      notas: f.notas,
      moneda: f.moneda ?? 'PEN',
      condicionesPago: f.condiciones_pago,
      lugarEntrega: f.lugar_entrega,
      atencion: f.atencion,
      solicitadoPor: f.solicitado_por,
      cotizacionRef: f.cotizacion_ref,
      proveedor: {
        id: f.proveedor?.id ?? '',
        razonSocial: f.proveedor?.razon_social ?? '',
        numeroDocumento: f.proveedor?.numero_documento ?? '',
        direccion: f.proveedor?.direccion ?? null,
      },
      almacen: { id: f.almacen?.id ?? '', nombre: f.almacen?.nombre ?? '' },
      items,
      subtotal: base / 100,
      igv: igv / 100,
      total: (base + igv) / 100,
      avance: pedido ? Math.round((recibido / pedido) * 100) : 0,
    };
  }
}
