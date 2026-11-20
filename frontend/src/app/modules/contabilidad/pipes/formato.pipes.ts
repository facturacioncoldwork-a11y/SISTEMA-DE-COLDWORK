import { Pipe, PipeTransform } from '@angular/core';

const NUMERO = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MES = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** 1234.5 → "1,234.50". Cero o vacío → "" (en los libros las celdas en blanco se leen mejor). */
@Pipe({ name: 'importe' })
export class ImportePipe implements PipeTransform {
  transform(valor: number | null | undefined, mostrarCero = false): string {
    if (!valor && !mostrarCero) return '';
    return NUMERO.format(valor ?? 0);
  }
}

/** "2026-11" → "noviembre de 2026". */
@Pipe({ name: 'periodo' })
export class PeriodoPipe implements PipeTransform {
  transform(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);
    return MES.format(new Date(Date.UTC(anio, mes - 1, 1)));
  }
}

/** Número de asiento con ceros: 7 → "0007". */
@Pipe({ name: 'correlativo' })
export class CorrelativoPipe implements PipeTransform {
  transform(numero: number): string {
    return String(numero).padStart(4, '0');
  }
}
