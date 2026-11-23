import { DatePipe } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectButtonModule } from 'primeng/selectbutton';
import {
  diasEntre,
  hoyISO,
  leerPlazo,
  PLAZOS_RAPIDOS,
  textoPlazo,
  ventana,
  type Plazo,
  type UnidadPlazo,
} from '../../models/plazos';

export interface ValorPlazo {
  plazoTexto: string;
  entregaDesde: string | null;
  entregaHasta: string | null;
}

/**
 * Captura el plazo tal como lo da el proveedor:
 *  · "Plazo": 2-3 semanas, 1 mes… (o lo escribe libre) → calcula la ventana de llegada.
 *  · "Fecha exacta": un día concreto.
 * Muestra en vivo "Llega aprox. entre el 4 y el 11 de dic".
 */
@Component({
  selector: 'app-plazo-entrega',
  imports: [FormsModule, DatePipe, InputNumberModule, SelectButtonModule],
  template: `
    <div class="caja">
      <div class="modos">
        <p-selectbutton
          [options]="modos"
          optionLabel="t"
          optionValue="v"
          [allowEmpty]="false"
          [ngModel]="modo()"
          (ngModelChange)="modo.set($event); emitir()"
          ariaLabel="Tipo de plazo"
        />
        <span class="desde">contando desde {{ base() | date: "d 'de' MMM" }}</span>
      </div>

      @if (modo() === 'plazo') {
        <div class="rapidos">
          @for (r of rapidos; track r.texto) {
            <button type="button" [class.on]="textoActual() === r.texto" (click)="usar(r.plazo)">
              {{ r.texto }}
            </button>
          }
        </div>
        <div class="fila">
          <label class="libre">
            <span>O escríbelo como lo dijo el proveedor</span>
            <input
              class="p-inputtext"
              type="text"
              placeholder="ej. 2 a 3 semanas, 45 días, 1-2 meses"
              [ngModel]="libre()"
              (ngModelChange)="escribir($event)"
            />
          </label>
          <div class="num">
            <span>De</span>
            <p-inputnumber
              [ngModel]="min()"
              (ngModelChange)="min.set($event ?? 1); ajustar()"
              [min]="1"
              [max]="400"
              [showButtons]="true"
              buttonLayout="horizontal"
              inputStyleClass="n"
              ariaLabel="Mínimo"
            />
            <span>a</span>
            <p-inputnumber
              [ngModel]="max()"
              (ngModelChange)="max.set($event ?? 1); ajustar()"
              [min]="1"
              [max]="400"
              [showButtons]="true"
              buttonLayout="horizontal"
              inputStyleClass="n"
              ariaLabel="Máximo"
            />
            <select
              class="p-inputtext"
              [ngModel]="unidad()"
              (ngModelChange)="unidad.set($event); ajustar()"
              aria-label="Unidad"
            >
              <option value="dias">días</option>
              <option value="semanas">semanas</option>
              <option value="meses">meses</option>
            </select>
          </div>
        </div>
      } @else if (modo() === 'fecha') {
        <input
          class="p-inputtext"
          type="date"
          [min]="base()"
          [ngModel]="fecha()"
          (ngModelChange)="fecha.set($event); emitir()"
          aria-label="Fecha exacta de entrega"
        />
      }

      @if (resultado(); as r) {
        <div class="calculo">
          <i class="pi pi-calendar-clock"></i>
          @if (r.entregaDesde === r.entregaHasta) {
            <span
              >Llega el <b>{{ r.entregaHasta | date: "EEEE d 'de' MMMM" }}</b></span
            >
          } @else {
            <span
              >Llega aprox. entre el <b>{{ r.entregaDesde | date: "EEE d 'de' MMM" }}</b> y el
              <b>{{ r.entregaHasta | date: "EEE d 'de' MMM y" }}</b></span
            >
          }
          @if (diasHasta() !== null) {
            <small>en {{ diasHasta() }} días</small>
          }
        </div>
      } @else if (modo() !== 'ninguno') {
        <div class="calculo vacio">
          <i class="pi pi-info-circle"></i> Elige o escribe el plazo para calcular la fecha.
        </div>
      }
    </div>
  `,
  styles: `
    .caja {
      display: grid;
      gap: 0.7rem;
    }
    .modos {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      flex-wrap: wrap;
    }
    .desde {
      font-size: 0.75rem;
      color: var(--lg-muted);
    }
    .rapidos {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .rapidos button {
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--lg-line);
      background: #fff;
      color: var(--lg-ink);
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      transition: all 0.15s;
    }
    .rapidos button:hover {
      border-color: #93c5fd;
    }
    .rapidos button.on {
      background: var(--lg-ink);
      color: #fff;
      border-color: var(--lg-ink);
    }
    .fila {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.8rem;
      align-items: end;
    }
    .libre span,
    .num > span {
      font-size: 0.74rem;
      color: var(--lg-muted);
    }
    .libre {
      display: grid;
      gap: 0.3rem;
    }
    .num {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .num select {
      width: auto;
    }
    :host ::ng-deep .n {
      width: 3rem;
      text-align: center;
    }
    .calculo {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      flex-wrap: wrap;
      padding: 0.65rem 0.8rem;
      border-radius: 0.8rem;
      font-size: 0.86rem;
      background: linear-gradient(135deg, #ecfeff, #eef2ff);
      border: 1px solid #c7d2fe;
    }
    .calculo i {
      color: var(--lg-indigo);
    }
    .calculo small {
      margin-left: auto;
      color: var(--lg-muted);
      font-weight: 600;
    }
    .calculo.vacio {
      background: var(--lg-soft);
      border-color: var(--lg-line);
      color: var(--lg-muted);
    }
    @media (max-width: 640px) {
      .fila {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class PlazoEntrega {
  /** Fecha desde la que se cuenta (la de la orden). */
  readonly base = input<string>(hoyISO());
  /** Valor inicial (al editar una orden). */
  readonly inicial = input<ValorPlazo | null>(null);
  readonly cambio = output<ValorPlazo>();

  protected readonly modos = [
    { t: 'Plazo', v: 'plazo' },
    { t: 'Fecha exacta', v: 'fecha' },
    { t: 'Aún no sé', v: 'ninguno' },
  ];
  protected readonly rapidos = PLAZOS_RAPIDOS;
  protected readonly modo = signal<'plazo' | 'fecha' | 'ninguno'>('plazo');
  protected readonly min = signal(2);
  protected readonly max = signal(3);
  protected readonly unidad = signal<UnidadPlazo>('semanas');
  protected readonly libre = signal('');
  protected readonly fecha = signal('');
  private readonly elegido = signal(false);

  protected readonly textoActual = computed(() =>
    this.elegido() || this.libre()
      ? textoPlazo({ min: this.min(), max: this.max(), unidad: this.unidad() })
      : '',
  );

  protected readonly resultado = computed<ValorPlazo | null>(() => {
    const m = this.modo();
    if (m === 'ninguno') return null;
    if (m === 'fecha')
      return this.fecha()
        ? { plazoTexto: 'Fecha exacta', entregaDesde: this.fecha(), entregaHasta: this.fecha() }
        : null;
    if (!this.textoActual()) return null;
    const p: Plazo = { min: this.min(), max: this.max(), unidad: this.unidad() };
    const v = ventana(this.base(), p);
    return { plazoTexto: textoPlazo(p), entregaDesde: v.desde, entregaHasta: v.hasta };
  });
  protected readonly diasHasta = computed(() => {
    const r = this.resultado();
    return r?.entregaDesde ? diasEntre(hoyISO(), r.entregaDesde) : null;
  });

  constructor() {
    // Cargar valor inicial (editar)
    effect(() => {
      const v = this.inicial();
      this.elegido.set(false);
      this.libre.set('');
      if (!v || (!v.entregaHasta && !v.plazoTexto)) {
        this.modo.set(v ? 'ninguno' : 'plazo');
        return;
      }
      const p = v.plazoTexto ? leerPlazo(v.plazoTexto) : null;
      if (p) {
        this.modo.set('plazo');
        this.min.set(p.min);
        this.max.set(p.max);
        this.unidad.set(p.unidad);
        this.elegido.set(true);
      } else {
        this.modo.set('fecha');
        this.fecha.set(v.entregaHasta ?? '');
      }
    });
  }

  protected usar(p: Plazo) {
    this.min.set(p.min);
    this.max.set(p.max);
    this.unidad.set(p.unidad);
    this.libre.set('');
    this.elegido.set(true);
    this.emitir();
  }

  protected escribir(t: string) {
    this.libre.set(t);
    const p = leerPlazo(t);
    if (p) {
      this.usar(p);
      this.libre.set(t);
    }
  }

  protected ajustar() {
    if (this.max() < this.min()) this.max.set(this.min());
    this.elegido.set(true);
    this.emitir();
  }

  protected emitir() {
    // computed se recalcula en el mismo tick
    queueMicrotask(() =>
      this.cambio.emit(
        this.resultado() ?? { plazoTexto: '', entregaDesde: null, entregaHasta: null },
      ),
    );
  }
}
