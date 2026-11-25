import { describe, expect, it } from 'vitest';
import type { Cotizacion } from '../models/cotizacion.model';
import { hitosConMonto, numeroCotizacion, problemasCotizacion, sumaHitos, totalesCotizacion, venceEl } from './cotizacion';

const base: Cotizacion = {
  id: 'x',
  serie: 'PROY',
  numero: 'YG-PROY202600098',
  clienteId: 'c1',
  atencion: '',
  celular: '',
  proyecto: 'Packing uva',
  ubicacion: '',
  fecha: '2026-08-31',
  validezDias: 5,
  moneda: 'USD',
  tiempoEntrega: '',
  notas: '',
  detraccion: 12,
  estado: 'borrador',
  hitos: [
    { id: 'h1', descripcion: '1.er adelanto con la orden', porcentaje: 40 },
    { id: 'h2', descripcion: '2.º adelanto según valorización', porcentaje: 50 },
    { id: 'h3', descripcion: 'Saldo con la entrega', porcentaje: 10 },
  ],
  secciones: [
    {
      id: 's1',
      titulo: 'Cámara #1',
      lineas: [
        { id: 'l1', descripcion: 'Unidad condensadora 12 HP', unidad: 'UND.', cantidad: 2, precio: 12250, costo: 10412.5 },
        // En el Excel este precio quedaba con decimales infinitos (4797/0.85)
        { id: 'l2', descripcion: 'Componentes del sistema', unidad: 'GLB.', cantidad: 1, precio: 5643.529411764706 },
      ],
    },
  ],
};

describe('cotización', () => {
  it('redondea cada línea a céntimos antes de sumar e incluye IGV 18 %', () => {
    const t = totalesCotizacion(base);
    expect(t.valorVenta).toBe(30143.53);
    expect(t.igv).toBe(5425.84);
    expect(t.total).toBe(35569.37);
  });

  it('margen solo con las líneas que tienen costo', () => {
    expect(totalesCotizacion(base).margen).toBe(15);
  });

  it('forma de pago 40/50/10: suma 100 % y el último hito absorbe los céntimos', () => {
    expect(sumaHitos(base.hitos)).toBe(100);
    expect(hitosConMonto(base.hitos, 246407.21).map((x) => x.monto)).toEqual([98562.88, 123203.61, 24640.72]);
    // Tercios: el último absorbe el céntimo que sobra
    const tercios = hitosConMonto(
      [
        { id: 'a', descripcion: 'A', porcentaje: 33.33 },
        { id: 'b', descripcion: 'B', porcentaje: 33.33 },
        { id: 'c', descripcion: 'C', porcentaje: 33.34 },
      ],
      100,
    );
    expect(tercios.map((x) => x.monto)).toEqual([33.33, 33.33, 33.34]);
  });

  it('número con el formato de la empresa (correlativo compartido)', () => {
    expect(numeroCotizacion('SERV', 2026, 99)).toBe('YG-SERV202600099');
  });

  it('no deja enviar si la forma de pago no suma 100 % o falta el cliente', () => {
    expect(problemasCotizacion(base)).toEqual([]);
    const mal = { ...base, clienteId: '', hitos: [{ id: 'h', descripcion: 'Adelanto', porcentaje: 60 }] };
    expect(problemasCotizacion(mal)).toEqual(['Elige el cliente (con su RUC).', 'La forma de pago suma 60 %: debe sumar 100 %.']);
  });

  it('fecha de vencimiento según la validez', () => {
    expect(venceEl(base)).toBe('2026-09-05');
  });
});
