import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { nivelStock } from '../../models/logistica.model';

/** Barra "termómetro" del stock frente al mínimo (semáforo por color). */
@Component({
  selector: 'app-medidor-stock',
  template: `
    <div class="fila">
      <strong>{{ cantidad() | number: '1.0-2' }}</strong>
      <small>{{ unidad() }}</small>
      <span class="lg-chip {{ nivel() }}">{{ textos[nivel()] }}</span>
    </div>
    <div
      class="lg-medidor {{ nivel() }}"
      role="meter"
      [attr.aria-valuenow]="cantidad()"
      [attr.aria-valuemin]="0"
      [attr.aria-valuemax]="tope()"
    >
      <span [style.width.%]="porcentaje()"></span>
    </div>
    @if (minimo() > 0) {
      <small class="min">mín. {{ minimo() | number: '1.0-2' }}</small>
    }
  `,
  imports: [DecimalPipe],
  styles: `
    :host {
      display: grid;
      gap: 0.3rem;
      min-width: 9rem;
    }
    .fila {
      display: flex;
      align-items: baseline;
      gap: 0.35rem;
    }
    .fila strong {
      font-size: 0.95rem;
    }
    .fila small,
    .min {
      color: var(--lg-muted);
      font-size: 0.72rem;
    }
    .fila .lg-chip {
      margin-left: auto;
      font-size: 0.66rem;
      padding: 0.1rem 0.45rem;
    }
  `,
})
export class MedidorStock {
  readonly cantidad = input.required<number>();
  readonly minimo = input(0);
  readonly unidad = input('');

  protected readonly nivel = computed(() => nivelStock(this.cantidad(), this.minimo()));
  /** La barra llena equivale a 3 veces el mínimo (o al stock si no hay mínimo). */
  protected readonly tope = computed(() => Math.max(this.minimo() * 3, this.cantidad(), 1));
  protected readonly porcentaje = computed(() =>
    Math.min(100, Math.max(this.cantidad() > 0 ? 4 : 0, (this.cantidad() / this.tope()) * 100)),
  );
  protected readonly textos = {
    ok: 'OK',
    bajo: 'Bajo',
    critico: 'Reponer',
    agotado: 'Agotado',
  } as const;
}
