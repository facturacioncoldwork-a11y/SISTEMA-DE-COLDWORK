import { redondear } from '../../../core/utils/montos';

/**
 * Estados financieros a partir de los saldos del PCGE (Debe/Haber por cuenta).
 *
 * - Estado de Resultados por naturaleza: elementos 6 y 7 (sin 79, que es contra la 9) y la 88 (renta).
 * - Estado de Situación Financiera: elementos 1 a 5 + el resultado del ejercicio aún no cerrado.
 *   La cuenta 40 (tributos) va al activo si tiene saldo deudor (ej. crédito fiscal de IGV) y al
 *   pasivo si es acreedor.
 *
 * Es información de gestión: los estados oficiales los firma el contador.
 */

export interface SaldoCuenta {
  cuenta: string;
  debe: number;
  haber: number;
}

export interface Renglon {
  nombre: string;
  monto: number;
  /** Cuentas (2 dígitos) que lo forman, con el mismo signo que el renglón. */
  cuentas: { codigo: string; monto: number }[];
}

export interface Seccion {
  nombre: string;
  renglones: Renglon[];
  total: number;
}

export { redondear };

/** Saldo deudor (positivo) o acreedor (negativo) agrupado por los primeros `digitos`. */
export function agrupar(saldos: SaldoCuenta[], digitos = 2): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const s of saldos) {
    const clave = s.cuenta.slice(0, digitos);
    mapa.set(clave, (mapa.get(clave) ?? 0) + s.debe - s.haber);
  }
  return mapa;
}

type Filtro = (c: string) => boolean;

/**
 * Renglón con las cuentas de 2 dígitos que cumplen el filtro.
 * signo 1 = saldo deudor en positivo (activo, gasto); −1 = saldo acreedor en positivo (pasivo, ingreso).
 */
function renglon(grupos: Map<string, number>, nombre: string, filtro: Filtro, signo: 1 | -1): Renglon {
  const cuentas = [...grupos]
    .filter(([c, v]) => filtro(c) && Math.abs(v) >= 0.005)
    .map(([codigo, v]) => ({ codigo, monto: redondear(signo * v) }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  return { nombre, monto: redondear(cuentas.reduce((s, c) => s + c.monto, 0)), cuentas };
}

const entre = (desde: number, hasta: number): Filtro => (c) => Number(c) >= desde && Number(c) <= hasta;
const en = (...lista: number[]): Filtro => (c) => lista.includes(Number(c));

// ─── Estado de Resultados ──────────────────────────────────────────

export interface EstadoResultados {
  ingresos: Seccion;
  gastos: Seccion;
  resultadoOperativo: number;
  financieros: Seccion;
  antesImpuestos: number;
  impuestoRenta: number;
  resultadoNeto: number;
  /** Margen neto sobre ventas netas, en %. */
  margen: number | null;
}

export function estadoResultados(saldos: SaldoCuenta[]): EstadoResultados {
  const g = agrupar(saldos);
  // En resultados todo va con signo acreedor: ingresos suman y gastos restan (salen negativos)
  const ingreso = (nombre: string, f: Filtro) => renglon(g, nombre, f, -1);
  const gasto = ingreso;

  const ventas = ingreso('Ventas de bienes y servicios', en(70));
  const descuentos = ingreso('Descuentos, rebajas y bonificaciones concedidos', en(74));
  const otrosIng = ingreso('Otros ingresos de gestión', en(71, 72, 73, 75, 76, 78));

  const ingresos = seccion('Ingresos', [ventas, descuentos, otrosIng]);
  const gastos = seccion('Gastos de operación', [
    gasto('Compras y consumo de existencias', en(60, 61, 69)),
    gasto('Gastos de personal', en(62)),
    gasto('Servicios prestados por terceros', en(63)),
    gasto('Tributos', en(64)),
    gasto('Otros gastos de gestión', en(65)),
    gasto('Pérdida por medición de activos', en(66)),
    gasto('Depreciación, amortización y provisiones', en(68)),
  ]);
  const resultadoOperativo = redondear(ingresos.total + gastos.total);

  const financieros = seccion('Resultado financiero', [
    ingreso('Ingresos financieros', en(77)),
    gasto('Gastos financieros', en(67)),
  ]);
  const antesImpuestos = redondear(resultadoOperativo + financieros.total);
  const impuestoRenta = renglon(g, 'Impuesto a la renta', en(88), -1).monto;
  const resultadoNeto = redondear(antesImpuestos + impuestoRenta);
  const ventasNetas = ventas.monto + descuentos.monto;

  return {
    ingresos,
    gastos,
    resultadoOperativo,
    financieros,
    antesImpuestos,
    impuestoRenta,
    resultadoNeto,
    margen: ventasNetas > 0 ? redondear((resultadoNeto / ventasNetas) * 100) : null,
  };
}

// ─── Estado de Situación Financiera ────────────────────────────────

export interface SituacionFinanciera {
  activoCorriente: Seccion;
  activoNoCorriente: Seccion;
  totalActivo: number;
  pasivoCorriente: Seccion;
  pasivoNoCorriente: Seccion;
  totalPasivo: number;
  patrimonio: Seccion;
  totalPasivoPatrimonio: number;
  /** Activo − (Pasivo + Patrimonio). Debe ser 0 si todos los asientos cuadran. */
  diferencia: number;
  /** Activo corriente / pasivo corriente. */
  liquidez: number | null;
}

export function situacionFinanciera(saldos: SaldoCuenta[]): SituacionFinanciera {
  const g = agrupar(saldos);
  const activo = (nombre: string, f: Filtro) => renglon(g, nombre, f, 1);
  const pasivo = (nombre: string, f: Filtro) => renglon(g, nombre, f, -1);

  // Tributos (40): al activo si su saldo es deudor, al pasivo si es acreedor
  const tributos = redondear(g.get('40') ?? 0);
  const es40: Filtro = (c) => c === '40';

  const activoCorriente = seccion('Activo corriente', [
    activo('Efectivo y equivalentes de efectivo', en(10)),
    activo('Inversiones financieras', en(11)),
    activo('Cuentas por cobrar comerciales', en(12, 13)),
    activo('Otras cuentas por cobrar', en(14, 15, 16, 17)),
    activo('Estimación de cuentas de cobranza dudosa', en(19)),
    activo('Servicios y otros contratados por anticipado', en(18)),
    activo('Inventarios', entre(20, 29)),
    activo('Tributos por recuperar (crédito fiscal)', (c) => tributos > 0 && es40(c)),
  ]);
  const activoNoCorriente = seccion('Activo no corriente', [
    activo('Propiedad, planta y equipo (neto)', en(33, 39)),
    activo('Activos intangibles', en(34)),
    activo('Otros activos no corrientes', en(30, 31, 32, 35, 36, 37, 38)),
  ]);
  const totalActivo = redondear(activoCorriente.total + activoNoCorriente.total);

  const pasivoCorriente = seccion('Pasivo corriente', [
    pasivo('Tributos por pagar', (c) => tributos < 0 && es40(c)),
    pasivo('Remuneraciones y participaciones por pagar', en(41)),
    pasivo('Cuentas por pagar comerciales', en(42, 43)),
    pasivo('Obligaciones financieras', en(45)),
    pasivo('Otras cuentas por pagar', en(44, 46, 47, 48)),
  ]);
  const pasivoNoCorriente = seccion('Pasivo no corriente', [pasivo('Pasivo diferido', en(49))]);
  const totalPasivo = redondear(pasivoCorriente.total + pasivoNoCorriente.total);

  // Resultado del ejercicio aún no cerrado: todo lo que no es elemento 1 a 5
  const resultado = renglon(g, 'Resultado del ejercicio', (c) => Number(c[0]) >= 6, -1).monto;
  const patrimonio = seccion('Patrimonio', [
    pasivo('Capital', en(50, 51)),
    pasivo('Capital adicional y excedente de revaluación', en(52, 53, 54, 55, 56, 57)),
    pasivo('Reservas', en(58)),
    pasivo('Resultados acumulados', en(59)),
    { nombre: 'Resultado del ejercicio', monto: resultado, cuentas: [] },
  ]);
  const totalPasivoPatrimonio = redondear(totalPasivo + patrimonio.total);

  return {
    activoCorriente,
    activoNoCorriente,
    totalActivo,
    pasivoCorriente,
    pasivoNoCorriente,
    totalPasivo,
    patrimonio,
    totalPasivoPatrimonio,
    diferencia: redondear(totalActivo - totalPasivoPatrimonio),
    liquidez: pasivoCorriente.total > 0 ? redondear(activoCorriente.total / pasivoCorriente.total) : null,
  };
}

function seccion(nombre: string, renglones: Renglon[]): Seccion {
  return { nombre, renglones, total: redondear(renglones.reduce((s, r) => s + r.monto, 0)) };
}

// ─── Resumen tributario del mes (referencia para el PDT 621) ───────

export interface ComprobanteIgv {
  operacion: 'venta' | 'compra';
  tipoDoc: string;
  estado: string;
  moneda: 'PEN' | 'USD';
  tipoCambio?: number;
  baseGravada: number;
  noGravada: number;
  igv: number;
  retencionRenta: number;
}

export interface ResumenTributario {
  ventasGravadas: number;
  ventasNoGravadas: number;
  igvVentas: number;
  comprasGravadas: number;
  igvCompras: number;
  /** IGV del mes: positivo = a pagar; negativo = saldo a favor para el mes siguiente. */
  igvResultado: number;
  retenciones4ta: number;
}

/** Comprobantes de compra que dan derecho a crédito fiscal (Tabla 10). */
const CON_CREDITO = ['01', '07', '08', '14'];

export function resumenTributario(comprobantes: ComprobanteIgv[]): ResumenTributario {
  let vg = 0;
  let vng = 0;
  let iv = 0;
  let cg = 0;
  let ic = 0;
  let r4 = 0;
  for (const c of comprobantes) {
    if (c.estado !== 'registrado') continue;
    const f = c.moneda === 'USD' ? (c.tipoCambio ?? 0) : 1;
    const s = c.tipoDoc === '07' ? -1 : 1;
    if (c.operacion === 'venta') {
      vg += s * c.baseGravada * f;
      vng += s * c.noGravada * f;
      iv += s * c.igv * f;
    } else {
      if (CON_CREDITO.includes(c.tipoDoc)) {
        cg += s * c.baseGravada * f;
        ic += s * c.igv * f;
      }
      r4 += c.retencionRenta * f;
    }
  }
  return {
    ventasGravadas: redondear(vg),
    ventasNoGravadas: redondear(vng),
    igvVentas: redondear(iv),
    comprasGravadas: redondear(cg),
    igvCompras: redondear(ic),
    igvResultado: redondear(iv - ic),
    retenciones4ta: redondear(r4),
  };
}
