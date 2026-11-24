import { Component, input, signal } from '@angular/core';
import { PCGE } from '../../../contabilidad/data/pcge';
import { dinero } from '../../../finanzas/utils/calculos';
import type { Seccion } from '../../utils/estados';

const NOMBRES = new Map(PCGE.map((c) => [c.codigo, c.nombre]));

/** Una sección de un estado financiero: renglones con su total; cada renglón muestra sus cuentas al tocarlo. */
@Component({
  // Selector de atributo en <tbody>: un elemento propio dentro de <table> rompería la tabla
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'tbody[app-estado-seccion]',
  template: `
    @let s = seccion();
      <tr class="titulo">
        <th colspan="2">{{ s.nombre }}</th>
      </tr>
      @for (r of visibles(); track r.nombre) {
        <tr class="renglon" [class.abre]="r.cuentas.length" (click)="r.cuentas.length && alternar(r.nombre)">
          <td>
            @if (r.cuentas.length) {
              <i class="pi" [class.pi-chevron-down]="abiertos().has(r.nombre)" [class.pi-chevron-right]="!abiertos().has(r.nombre)"></i>
            }
            {{ r.nombre }}
          </td>
          <td class="num" [class.lg-neg]="r.monto < 0">{{ formato(r.monto) }}</td>
        </tr>
        @if (abiertos().has(r.nombre)) {
          @for (c of r.cuentas; track c.codigo) {
            <tr class="cuenta">
              <td><span class="lg-mono">{{ c.codigo }}</span> {{ nombre(c.codigo) }}</td>
              <td class="num">{{ formato(c.monto) }}</td>
            </tr>
          }
        }
      } @empty {
        <tr class="renglon vacio">
          <td colspan="2">Sin movimientos</td>
        </tr>
      }
      <tr class="total">
        <td>Total {{ s.nombre.toLowerCase() }}</td>
        <td class="num" [class.lg-neg]="s.total < 0">{{ formato(s.total) }}</td>
      </tr>
  `,
  styles: `
    .titulo th { text-align: left; padding: 1rem 0.9rem 0.4rem; font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--lg-muted); }
    td { padding: 0.5rem 0.9rem; border-bottom: 1px solid var(--lg-line); font-size: 0.9rem; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .renglon.abre { cursor: pointer; }
    .renglon.abre:hover td { background: var(--lg-soft); }
    .renglon i { font-size: 0.7rem; color: var(--lg-muted); margin-right: 0.35rem; }
    .cuenta td { font-size: 0.8rem; color: var(--lg-muted); padding-left: 2.2rem; background: #fafcfe; }
    .vacio td { color: var(--lg-muted); font-style: italic; }
    .total td { font-weight: 700; border-bottom: 2px solid var(--lg-ink); }
    @media print { .renglon i { display: none; } }
  `,
})
export class EstadoSeccion {
  readonly seccion = input.required<Seccion>();
  /** Muestra también los renglones en cero (para estados comparables). */
  readonly conCeros = input(false);

  protected readonly abiertos = signal(new Set<string>());

  protected visibles() {
    return this.seccion().renglones.filter((r) => this.conCeros() || r.monto !== 0 || r.cuentas.length);
  }

  protected alternar(nombre: string) {
    this.abiertos.update((s) => {
      const n = new Set(s);
      if (n.has(nombre)) n.delete(nombre);
      else n.add(nombre);
      return n;
    });
  }

  protected nombre(codigo: string): string {
    return NOMBRES.get(codigo) ?? '';
  }

  protected formato(n: number): string {
    return dinero(n);
  }
}
