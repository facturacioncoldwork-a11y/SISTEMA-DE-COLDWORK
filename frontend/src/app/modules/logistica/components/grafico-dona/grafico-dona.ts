import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';

export interface Porcion {
  etiqueta: string;
  valor: number;
  color: string;
}

/** Dona en SVG con leyenda interactiva (resalta la porción al pasar el mouse). */
@Component({
  selector: 'app-grafico-dona',
  imports: [CurrencyPipe, DecimalPipe],
  template: `
    <div class="caja">
      <svg viewBox="0 0 120 120" role="img" aria-label="Valor del inventario por tipo">
        <circle cx="60" cy="60" r="46" class="fondo" />
        @for (a of arcos(); track a.etiqueta) {
          <circle
            cx="60"
            cy="60"
            r="46"
            [attr.stroke]="a.color"
            [attr.stroke-dasharray]="a.largo + ' ' + (circ - a.largo)"
            [attr.stroke-dashoffset]="-a.inicio"
            [class.apagado]="foco() && foco() !== a.etiqueta"
            class="arco"
          />
        }
        <text x="60" y="56" text-anchor="middle" class="t1">{{ centro().titulo }}</text>
        <text x="60" y="72" text-anchor="middle" class="t2">
          {{ centro().valor | currency: 'PEN' : 'symbol-narrow' : '1.0-0' }}
        </text>
      </svg>
      <ul>
        @for (a of arcos(); track a.etiqueta) {
          <li
            (mouseenter)="foco.set(a.etiqueta)"
            (mouseleave)="foco.set(null)"
            [class.on]="foco() === a.etiqueta"
          >
            <i [style.background]="a.color"></i>
            <span>{{ a.etiqueta }}</span>
            <b>{{ a.pct | number: '1.0-0' }}%</b>
          </li>
        } @empty {
          <li class="vacio">Sin stock valorizado todavía</li>
        }
      </ul>
    </div>
  `,
  styles: `
    .caja {
      display: grid;
      grid-template-columns: 9.5rem 1fr;
      gap: 1rem;
      align-items: center;
    }
    svg {
      width: 100%;
      transform: rotate(-90deg);
    }
    svg text {
      transform: rotate(90deg);
      transform-origin: 60px 60px;
    }
    .fondo {
      fill: none;
      stroke: #eef3f8;
      stroke-width: 14;
    }
    .arco {
      fill: none;
      stroke-width: 14;
      transition:
        opacity 0.2s,
        stroke-width 0.2s;
    }
    .arco.apagado {
      opacity: 0.2;
    }
    .t1 {
      font-size: 7px;
      fill: #8a9bb0;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .t2 {
      font-size: 11px;
      font-weight: 800;
      fill: #0b1b2b;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.3rem;
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.84rem;
      padding: 0.35rem 0.5rem;
      border-radius: 0.55rem;
      cursor: default;
    }
    li.on {
      background: var(--lg-soft);
    }
    li i {
      width: 0.7rem;
      height: 0.7rem;
      border-radius: 0.25rem;
    }
    li span {
      flex: 1;
    }
    li.vacio {
      color: var(--lg-muted);
    }
  `,
})
export class GraficoDona {
  readonly datos = input<Porcion[]>([]);
  protected readonly foco = signal<string | null>(null);
  protected readonly circ = 2 * Math.PI * 46;

  protected readonly total = computed(() => this.datos().reduce((t, d) => t + d.valor, 0));
  protected readonly arcos = computed(() => {
    const total = this.total() || 1;
    let inicio = 0;
    return this.datos()
      .filter((d) => d.valor > 0)
      .map((d) => {
        const largo = (d.valor / total) * this.circ;
        const a = { ...d, largo: Math.max(largo - 2, 0.5), inicio, pct: (d.valor / total) * 100 };
        inicio += largo;
        return a;
      });
  });
  protected readonly centro = computed(() => {
    const f = this.arcos().find((a) => a.etiqueta === this.foco());
    return f
      ? { titulo: f.etiqueta.slice(0, 14), valor: f.valor }
      : { titulo: 'Total', valor: this.total() };
  });
}
