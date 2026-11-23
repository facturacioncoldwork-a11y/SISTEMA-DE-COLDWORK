import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import type { OrdenCompra } from '../../models/logistica.model';
import {
  aISO,
  colorCliente,
  colorLlegada,
  deISO,
  diasEntre,
  hoyISO,
  seguimiento,
} from '../../models/plazos';

interface Fila {
  o: OrdenCompra;
  s: ReturnType<typeof seguimiento>;
  transito: { izq: number; ancho: number };
  ventana: { izq: number; ancho: number } | null;
  real: number | null;
  compromiso: number | null;
  entregado: number | null;
}

/**
 * Línea de tiempo de compras: para cada orden muestra
 *  ── tránsito (desde que se pidió) ▬▬ ventana de llegada ◆ llegó  ⚑ prometido al cliente  ✔ entregado
 * con la marca de HOY. Clic en una fila → abre la orden.
 */
@Component({
  selector: 'app-linea-tiempo',
  imports: [DatePipe, DecimalPipe],
  template: `
    <div class="lg-card lt">
      <div class="leyenda">
        <span><i class="tr"></i> En tránsito</span>
        <span><i class="ve"></i> Ventana de llegada</span>
        <span><i class="rombo"></i> Llegó</span>
        <span><i class="pi pi-flag-fill" style="color:#6366f1"></i> Prometido al cliente</span>
        <span><i class="pi pi-check-circle" style="color:#059669"></i> Entregado</span>
      </div>
      <div class="rejilla">
        <div class="cab-fila">
          <div class="izq"></div>
          <div class="eje">
            @for (m of marcas(); track m.pos) {
              <span class="marca" [style.left.%]="m.pos">{{ m.fecha | date: 'd MMM' }}</span>
            }
            <span class="hoy-et" [style.left.%]="hoy()">Hoy</span>
          </div>
        </div>
        @for (f of filas(); track f.o.id) {
          <button type="button" class="fila" (click)="abrir.emit(f.o)">
            <div class="izq">
              <span class="lg-mono">{{ f.o.codigo }}</span>
              <strong>{{ f.o.proveedor.razonSocial }}</strong>
              <small>
                <span class="lg-eta" [style.--c]="color(f)"
                  ><i class="pi pi-truck"></i> {{ f.s.textoLlegada }}</span
                >
                @if (f.o.cliente) {
                  · {{ f.o.cliente }}
                }
              </small>
            </div>
            <div class="pista">
              @for (m of marcas(); track m.pos) {
                <span class="guia" [style.left.%]="m.pos"></span>
              }
              <span class="hoy" [style.left.%]="hoy()"></span>
              <span
                class="transito"
                [style.left.%]="f.transito.izq"
                [style.width.%]="f.transito.ancho"
              ></span>
              @if (f.ventana; as v) {
                <span
                  class="ventana"
                  [style.left.%]="v.izq"
                  [style.width.%]="v.ancho"
                  [style.--c]="color(f)"
                  [title]="f.o.plazoTexto ?? ''"
                >
                  @if (v.ancho > 9) {
                    {{ f.o.plazoTexto }}
                  }
                </span>
              }
              @if (f.real !== null) {
                <span
                  class="rombo"
                  [style.left.%]="f.real"
                  [title]="'Llegó ' + f.o.fechaLlegadaReal"
                ></span>
              }
              @if (f.compromiso !== null) {
                <i
                  class="pi pi-flag-fill bandera"
                  [style.left.%]="f.compromiso"
                  [style.color]="colorCli(f)"
                  [title]="'Prometido ' + f.o.compromisoCliente"
                ></i>
              }
              @if (f.entregado !== null) {
                <i
                  class="pi pi-check-circle ok"
                  [style.left.%]="f.entregado"
                  [title]="'Entregado ' + f.o.entregadoCliente"
                ></i>
              }
            </div>
            <div class="der">
              {{ f.o.moneda === 'USD' ? 'US$' : 'S/' }} {{ f.o.total | number: '1.0-0' }}
            </div>
          </button>
        } @empty {
          <div class="lg-vacio">
            <i class="pi pi-calendar"></i>
            <h4>Nada en camino</h4>
            <p>Las órdenes enviadas con plazo aparecen aquí.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .lt {
      padding: 1rem 1.1rem;
    }
    .leyenda {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.76rem;
      color: var(--lg-muted);
      margin-bottom: 0.8rem;
    }
    .leyenda span {
      display: inline-flex;
      gap: 0.35rem;
      align-items: center;
    }
    .leyenda .tr {
      width: 1.2rem;
      height: 3px;
      background: repeating-linear-gradient(90deg, #94a3b8 0 4px, transparent 4px 7px);
    }
    .leyenda .ve {
      width: 1.2rem;
      height: 0.7rem;
      border-radius: 0.3rem;
      background: linear-gradient(90deg, #22d3ee, #6366f1);
    }
    .leyenda .rombo,
    .rombo {
      width: 0.7rem;
      height: 0.7rem;
      background: #059669;
      transform: rotate(45deg);
      display: inline-block;
      border-radius: 2px;
    }
    .rejilla {
      overflow-x: auto;
    }
    .cab-fila,
    .fila {
      display: grid;
      grid-template-columns: 17rem minmax(28rem, 1fr) 5.5rem;
      gap: 0.8rem;
      align-items: center;
      min-width: 52rem;
    }
    .eje {
      position: relative;
      height: 1.4rem;
    }
    .marca {
      position: absolute;
      transform: translateX(-50%);
      font-size: 0.68rem;
      color: var(--lg-muted);
      white-space: nowrap;
    }
    .hoy-et {
      position: absolute;
      transform: translateX(-50%);
      font-size: 0.68rem;
      font-weight: 800;
      color: #fff;
      background: #ef4444;
      padding: 0 0.35rem;
      border-radius: 0.3rem;
    }
    .fila {
      width: 100%;
      font: inherit;
      color: inherit;
      text-align: left;
      border: 0;
      background: transparent;
      cursor: pointer;
      padding: 0.55rem 0.3rem;
      border-top: 1px solid var(--lg-line);
      border-radius: 0.6rem;
    }
    .fila:hover {
      background: #f7fafd;
    }
    .izq {
      display: grid;
      min-width: 0;
    }
    .izq strong {
      font-size: 0.86rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .izq small {
      font-size: 0.74rem;
      color: var(--lg-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pista {
      position: relative;
      height: 2rem;
    }
    .guia {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: #eef2f7;
    }
    .hoy {
      position: absolute;
      top: -0.4rem;
      bottom: -0.4rem;
      width: 2px;
      background: #ef4444;
      z-index: 2;
    }
    .transito {
      position: absolute;
      top: 50%;
      height: 3px;
      transform: translateY(-50%);
      background: repeating-linear-gradient(90deg, #94a3b8 0 4px, transparent 4px 7px);
    }
    .ventana {
      position: absolute;
      top: 0.3rem;
      bottom: 0.3rem;
      min-width: 6px;
      border-radius: 0.4rem;
      color: #fff;
      font-size: 0.66rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      overflow: hidden;
      background: linear-gradient(90deg, color-mix(in srgb, var(--c) 70%, white), var(--c));
      box-shadow: 0 4px 10px -4px var(--c);
    }
    .pista .rombo {
      position: absolute;
      top: 50%;
      margin: -0.35rem 0 0 -0.35rem;
      z-index: 3;
      box-shadow: 0 0 0 2px #fff;
    }
    .bandera,
    .ok {
      position: absolute;
      top: 50%;
      transform: translate(-30%, -50%);
      font-size: 0.95rem;
      z-index: 3;
      text-shadow: 0 0 3px #fff;
    }
    .ok {
      color: #059669;
    }
    .der {
      text-align: right;
      font-weight: 700;
      font-size: 0.84rem;
    }
  `,
})
export class LineaTiempo {
  readonly ordenes = input<OrdenCompra[]>([]);
  readonly abrir = output<OrdenCompra>();

  /** Rango visible: de 1 semana antes de la orden más antigua a 1 semana después de la última fecha. */
  private readonly rango = computed(() => {
    const hoy = hoyISO();
    const fechas = [hoy];
    for (const o of this.ordenes()) {
      fechas.push(o.fecha.slice(0, 10));
      for (const f of [o.entregaHasta, o.fechaLlegadaReal, o.compromisoCliente, o.entregadoCliente])
        if (f) fechas.push(f);
    }
    fechas.sort();
    const ini = deISO(fechas[0]);
    ini.setDate(ini.getDate() - 3);
    const fin = deISO(fechas[fechas.length - 1]);
    fin.setDate(fin.getDate() + 7);
    return { ini: aISO(ini), dias: Math.max(diasEntre(aISO(ini), aISO(fin)), 21) };
  });
  private pos(f: string): number {
    const r = this.rango();
    return Math.min(100, Math.max(0, (diasEntre(r.ini, f.slice(0, 10)) / r.dias) * 100));
  }

  protected readonly hoy = computed(() => this.pos(hoyISO()));
  protected readonly marcas = computed(() => {
    const r = this.rango();
    const paso = r.dias > 90 ? 14 : 7;
    const out: { fecha: string; pos: number }[] = [];
    for (let d = 0; d <= r.dias; d += paso) {
      const f = deISO(r.ini);
      f.setDate(f.getDate() + d);
      out.push({ fecha: aISO(f), pos: (d / r.dias) * 100 });
    }
    return out;
  });

  protected readonly filas = computed<Fila[]>(() =>
    this.ordenes()
      .filter((o) => o.estado !== 'anulada')
      .sort((a, b) => (a.entregaHasta ?? '9999').localeCompare(b.entregaHasta ?? '9999'))
      .map((o) => {
        const s = seguimiento(o);
        const emitida = this.pos(o.fecha);
        const desde = o.entregaDesde ?? o.entregaHasta;
        const ventana =
          desde && o.entregaHasta
            ? {
                izq: this.pos(desde),
                ancho: Math.max(this.pos(o.entregaHasta) - this.pos(desde), 0.8),
              }
            : null;
        const finTransito = o.fechaLlegadaReal
          ? this.pos(o.fechaLlegadaReal)
          : ventana
            ? ventana.izq
            : this.hoy();
        return {
          o,
          s,
          transito: { izq: emitida, ancho: Math.max(finTransito - emitida, 0) },
          ventana,
          real: o.fechaLlegadaReal ? this.pos(o.fechaLlegadaReal) : null,
          compromiso: o.compromisoCliente ? this.pos(o.compromisoCliente) : null,
          entregado: o.entregadoCliente ? this.pos(o.entregadoCliente) : null,
        };
      }),
  );

  protected color(f: Fila) {
    return colorLlegada(f.s.llegada);
  }
  protected colorCli(f: Fila) {
    return f.s.cliente === 'riesgo' || f.s.cliente === 'vencido'
      ? colorCliente(f.s.cliente)
      : '#6366f1';
  }
}
