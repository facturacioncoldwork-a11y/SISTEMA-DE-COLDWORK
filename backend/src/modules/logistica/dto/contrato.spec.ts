import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ActualizarOrdenCompraDto,
  CrearLlegadaDto,
  CrearOrdenCompraDto,
  CrearSalidaDto,
} from './index.js';

/**
 * Contrato frontend ↔ backend: lo que envía la app (frontend/src/app/modules/logistica)
 * debe pasar la validación con las mismas opciones que main (whitelist + forbidNonWhitelisted).
 * Si el frontend agrega un campo y aquí no se declara, la API respondería 400.
 */
async function errores<T extends object>(clase: new () => T, cuerpo: unknown) {
  const dto = plainToInstance(clase, cuerpo);
  const e = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return e.flatMap((x) => [
    x.property,
    ...(x.children ?? []).map((c) => `${x.property}.${c.property}`),
  ]);
}
const uuid = '00000000-0000-4000-8000-000000000001';

describe('contrato de la API de logística', () => {
  it('llegada con fecha real, moneda y tipo de cambio', async () => {
    const cuerpo = {
      almacenId: uuid,
      ordenId: uuid,
      guiaRemision: 'T001-1',
      comprobante: 'F001-2',
      notas: '',
      fecha: '2026-11-20T17:00:00.000Z',
      moneda: 'USD',
      tipoCambio: 3.75,
      items: [{ productoId: uuid, cantidad: 4, costoUnitario: 56.25 }],
    };
    expect(await errores(CrearLlegadaDto, cuerpo)).toEqual([]);
  });

  it('llegada en dólares sin tipo de cambio → error', async () => {
    const cuerpo = {
      almacenId: uuid,
      moneda: 'USD',
      items: [{ productoId: uuid, cantidad: 1, costoUnitario: 1 }],
    };
    expect(await errores(CrearLlegadaDto, cuerpo)).toContain('tipoCambio');
  });

  it('orden de compra importada de una cotización (todos los campos)', async () => {
    const cuerpo = {
      proveedorId: uuid,
      almacenId: uuid,
      enviar: true,
      moneda: 'USD',
      plazoTexto: '2-3 semanas',
      entregaDesde: '2026-12-04',
      entregaHasta: '2026-12-11',
      cliente: 'Plaza Vea',
      compromisoCliente: null,
      notas: '',
      condicionesPago: 'Contado',
      lugarEntrega: 'Ica',
      atencion: 'José',
      solicitadoPor: 'José Sánchez',
      cotizacionRef: 'HC 1724',
      items: [{ productoId: uuid, cantidad: 12, costoUnitario: 30 }],
    };
    expect(await errores(CrearOrdenCompraDto, cuerpo)).toEqual([]);
  });

  it('editar orden: entregar al cliente y deshacer', async () => {
    expect(
      await errores(ActualizarOrdenCompraDto, {
        entregadoCliente: '2026-12-14',
      }),
    ).toEqual([]);
    expect(
      await errores(ActualizarOrdenCompraDto, { entregadoCliente: null }),
    ).toEqual([]);
  });

  it('salida por transferencia', async () => {
    const cuerpo = {
      almacenId: uuid,
      motivo: 'transferencia',
      almacenDestinoId: uuid,
      destino: '',
      responsable: 'Jorge',
      referencia: '',
      notas: '',
      items: [{ productoId: uuid, cantidad: 2 }],
    };
    expect(await errores(CrearSalidaDto, cuerpo)).toEqual([]);
  });

  it('un campo desconocido se rechaza (por eso existe esta prueba)', async () => {
    expect(
      await errores(CrearSalidaDto, {
        almacenId: uuid,
        motivo: 'venta',
        items: [],
        campoNuevo: 1,
      }),
    ).toContain('campoNuevo');
  });
});
