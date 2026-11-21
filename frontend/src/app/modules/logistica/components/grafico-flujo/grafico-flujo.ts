import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';

export interface PuntoFlujo {
  dia: string;
  entradas: number;
  salidas: number;
}

/**
 * Barras dobles (entradas vs salidas en soles) de los últimos días, en SVG puro:
 * sin librerías de gráficos, se ve nítido y pesa casi nada. Al pasar el mouse
 * muestra el detalle del día.
 */
@Component({
  selector: 'app-grafico-flujo',
  imports: [CurrencyPipe, DatePipe],
  template: `
    <div class="leyenda">
      <span><i class="e"></i> Entradas</span>
      <span><i class="s"></i> Salidas</span>
      @if (activo(); as a) {
        <span class="detalle">
          {{ a.dia | date: "EEE d 'de' MMM" }} ·
          <b class="lg-pos">{{ a.entradas | currency: 'PEN' : 'symbol-narrow' : '1.0-0' }}</b> /
          <b class="lg-neg">{{ a.salidas | currency: 'PEN' : 'symbol-narrow' : '1.0-0' }}</b>
        </span>
      }
    </div>
    <svg
      [attr.viewBox]="'0 0 ' + ancho + ' ' + alto"
      preserveAspectRatio="none"
      role="img"
      aria-label="Entradas y salidas por día"
    >
      <defs>
        <linearGradient id="gf-e" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#22d3ee" />
          <stop offset="1" stop-color="#3b82f6" />
        </linearGradient>
        <linearGradient id="gf-s" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#c4b5fd" />
          <stop offset="1" stop-color="#6366f1" />
        </linearGradient>
      </defs>
      @for (g of guias; track g) {
        <line
          [attr.x1]="0"
          [attr.x2]="ancho"
          [attr.y1]="alto - 18 - g * (alto - 28)"
          [attr.y2]="alto - 18 - g * (alto - 28)"
          class="guia"
        />
      }
      @for (b of barras(); track b.dia; let i = $index) {
        <g
          (mouseenter)="activo.set(b)"
          (mouseleave)="activo.set(null)"
          class="dia"
          [class.on]="activo()?.dia === b.dia"
        >
          <rect
            [attr.x]="b.x - 2"
            y="0"
            [attr.width]="paso - 4"
            [attr.height]="alto"
            class="zona"
          />
          <rect
            [attr.x]="b.x"
            [attr.y]="alto - 18 - b.he"
            [attr.width]="anchoBarra"
            [attr.height]="b.he"
            rx="3"
            fill="url(#gf-e)"
          />
          <rect
            [attr.x]="b.x + anchoBarra + 2"
            [attr.y]="alto - 18 - b.hs"
            [attr.width]="anchoBarra"
            [attr.height]="b.hs"
            rx="3"
            fill="url(#gf-s)"
          />
          @if (i % 2 === 0) {
            <text [attr.x]="b.x + anchoBarra" [attr.y]="alto - 4" text-anchor="middle">
              {{ b.dia | date: 'd/M' }}
            </text>
          }
        </g>
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }
    svg {
      width: 100%;
      height: 13rem;
      display: block;
      overflow: visible;
    }
    .guia {
      stroke: #e8eef5;
      stroke-dasharray: 3 4;
    }
    text {
      font-size: 9px;
      fill: #8a9bb0;
    }
    .zona {
      fill: transparent;
    }
    .dia.on .zona {
      fill: rgb(59 130 246 / 0.06);
    }
    .leyenda {
      display: flex;
      gap: 1rem;
      font-size: 0.78rem;
      color: var(--lg-muted);
      margin-bottom: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .leyenda i {
      display: inline-block;
      width: 0.65rem;
      height: 0.65rem;
      border-radius: 0.2rem;
      margin-right: 0.3rem;
      vertical-align: -1px;
    }
    .leyenda .e {
      background: linear-gradient(#22d3ee, #3b82f6);
    }
    .leyenda .s {
      background: linear-gradient(#c4b5fd, #6366f1);
    }
    .detalle {
      margin-left: auto;
      color: var(--lg-ink);
    }
  `,
})
export class GraficoFlujo {
  readonly datos = input<PuntoFlujo[]>([]);
  protected readonly activo = signal<PuntoFlujo | null>(null);

  protected readonly ancho = 560;
  protected readonly alto = 200;
  protected readonly guias = [0, 0.25, 0.5, 0.75, 1];
  protected get paso() {
    return this.ancho / Math.max(this.datos().length, 1);
  }
  protected get anchoBarra() {
    return Math.max(4, this.paso / 2 - 6);
  }

  protected readonly barras = computed(() => {
    const d = this.datos();
    const max = Math.max(1, ...d.map((x) => Math.max(x.entradas, x.salidas)));
    const util = this.alto - 28;
    const paso = this.ancho / Math.max(d.length, 1);
    return d.map((x, i) => ({
      ...x,
      x: i * paso + 4,
      he: Math.max(x.entradas > 0 ? 2 : 0, (x.entradas / max) * util),
      hs: Math.max(x.salidas > 0 ? 2 : 0, (x.salidas / max) * util),
    }));
  });
}
