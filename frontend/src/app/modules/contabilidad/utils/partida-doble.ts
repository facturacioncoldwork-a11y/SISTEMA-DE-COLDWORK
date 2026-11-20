import type { Asiento, Cuenta, FilaBalance, LineaAsiento, MovimientoMayor, NuevoAsiento } from '../models/contabilidad.model';

/**
 * Reglas de la partida doble y cálculos de los libros.
 * Funciones puras: no dependen de Angular y tienen pruebas en partida-doble.spec.ts.
 */

/** Redondea a céntimos para evitar errores de coma flotante. */
export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─── Validación de asientos ─────────────────────────────────────

export interface Totales {
  debe: number;
  haber: number;
  diferencia: number;
}

export function totales(lineas: LineaAsiento[]): Totales {
  const debe = redondear(lineas.reduce((s, l) => s + (l.debe || 0), 0));
  const haber = redondear(lineas.reduce((s, l) => s + (l.haber || 0), 0));
  return { debe, haber, diferencia: redondear(debe - haber) };
}

/** Devuelve la lista de problemas del asiento; vacía = se puede registrar. */
export function validarAsiento(asiento: NuevoAsiento, cuentas: ReadonlyMap<string, Cuenta>): string[] {
  const errores: string[] = [];

  if (!asiento.fecha) errores.push('Falta la fecha de la operación.');
  if (!asiento.glosa.trim()) errores.push('Escribe la glosa (descripción de la operación).');
  if (asiento.moneda === 'USD' && !(asiento.tipoCambio && asiento.tipoCambio > 0)) {
    errores.push('Indica el tipo de cambio para operaciones en dólares.');
  }

  const lineas = asiento.lineas.filter((l) => l.cuenta || l.debe || l.haber);
  if (lineas.length < 2) errores.push('Un asiento necesita al menos dos líneas (un cargo y un abono).');

  lineas.forEach((l, i) => {
    const n = i + 1;
    const cuenta = cuentas.get(l.cuenta);
    if (!l.cuenta) errores.push(`Línea ${n}: elige una cuenta.`);
    else if (!cuenta) errores.push(`Línea ${n}: la cuenta ${l.cuenta} no existe en el plan.`);
    else if (!cuenta.movimiento) errores.push(`Línea ${n}: ${l.cuenta} es de resumen; usa una subcuenta.`);

    if (l.debe < 0 || l.haber < 0) errores.push(`Línea ${n}: los importes no pueden ser negativos.`);
    if (l.debe > 0 && l.haber > 0) errores.push(`Línea ${n}: va al Debe o al Haber, no a ambos.`);
    if (!(l.debe > 0) && !(l.haber > 0)) errores.push(`Línea ${n}: falta el importe.`);
  });

  const t = totales(lineas);
  if (t.debe === 0) errores.push('El asiento no tiene importes.');
  else if (t.diferencia !== 0) errores.push(`No cuadra: el Debe y el Haber difieren en ${t.diferencia.toFixed(2)}.`);

  return errores;
}

// ─── Libro Mayor ────────────────────────────────────────────────

/** Asientos que cuentan para los libros (los borradores y anulados no). */
export function vigentes(asientos: Asiento[]): Asiento[] {
  return asientos.filter((a) => a.estado === 'registrado');
}

/** Movimientos de una cuenta (incluye sus subcuentas) con saldo acumulado según su naturaleza. */
export function mayorDeCuenta(asientos: Asiento[], cuenta: Cuenta): MovimientoMayor[] {
  const signo = cuenta.naturaleza === 'deudora' ? 1 : -1;
  const ordenados = [...vigentes(asientos)].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero);

  let saldo = 0;
  const movimientos: MovimientoMayor[] = [];
  for (const a of ordenados) {
    for (const l of a.lineas) {
      if (!l.cuenta.startsWith(cuenta.codigo)) continue;
      saldo = redondear(saldo + signo * (l.debe - l.haber));
      movimientos.push({
        asientoId: a.id,
        numero: a.numero,
        fecha: a.fecha,
        glosa: l.glosa || a.glosa,
        debe: l.debe,
        haber: l.haber,
        saldo,
      });
    }
  }
  return movimientos;
}

/** Saldo de un grupo de cuentas (por prefijo), positivo en el sentido de su naturaleza. */
export function saldo(asientos: Asiento[], prefijo: string, naturaleza: 'deudora' | 'acreedora'): number {
  let neto = 0;
  for (const a of vigentes(asientos)) {
    for (const l of a.lineas) {
      if (l.cuenta.startsWith(prefijo)) neto += l.debe - l.haber;
    }
  }
  return redondear(naturaleza === 'deudora' ? neto : -neto);
}

// ─── Balance de Comprobación ────────────────────────────────────

/** Sumas y saldos agrupados por cuenta de 2 dígitos. */
export function balanceComprobacion(asientos: Asiento[], cuentas: ReadonlyMap<string, Cuenta>): FilaBalance[] {
  const sumas = new Map<string, { debe: number; haber: number }>();
  for (const a of vigentes(asientos)) {
    for (const l of a.lineas) {
      const clave = l.cuenta.slice(0, 2);
      const s = sumas.get(clave) ?? { debe: 0, haber: 0 };
      s.debe += l.debe;
      s.haber += l.haber;
      sumas.set(clave, s);
    }
  }

  return [...sumas.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cuenta, s]) => {
      const neto = redondear(s.debe - s.haber);
      return {
        cuenta,
        nombre: cuentas.get(cuenta)?.nombre ?? '',
        sumaDebe: redondear(s.debe),
        sumaHaber: redondear(s.haber),
        saldoDeudor: neto > 0 ? neto : 0,
        saldoAcreedor: neto < 0 ? -neto : 0,
      };
    });
}
