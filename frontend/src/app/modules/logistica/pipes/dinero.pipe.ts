import { formatCurrency, getCurrencySymbol } from '@angular/common';
import { inject, LOCALE_ID, Pipe, type PipeTransform } from '@angular/core';
import { LogisticaStore } from '../services/logistica-store.service';

/**
 * Monto en la moneda del inventario de la empresa (soles o dólares, ver Panel → ajustes).
 * Uso: {{ p.valorizado | dinero }}  ·  {{ total | dinero: '1.0-0' }}
 * Impuro: si el dueño cambia la moneda, todas las pantallas se actualizan.
 */
@Pipe({ name: 'dinero', pure: false })
export class DineroPipe implements PipeTransform {
  private readonly store = inject(LogisticaStore);
  private readonly locale = inject(LOCALE_ID);

  transform(valor: number | null | undefined, digitos = '1.2-2'): string {
    if (valor === null || valor === undefined || Number.isNaN(valor)) return '';
    const moneda = this.store.moneda();
    const simbolo = moneda === 'USD' ? 'US$' : getCurrencySymbol(moneda, 'narrow', this.locale);
    return formatCurrency(valor, this.locale, simbolo, moneda, digitos);
  }
}
