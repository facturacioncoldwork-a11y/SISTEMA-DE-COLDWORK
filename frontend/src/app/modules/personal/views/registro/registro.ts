import { Component, computed, inject, signal } from '@angular/core';
import { descargarCsv } from '../../../finanzas/utils/csv';
import { AsistenciaSim } from '../../services/asistencia-sim.service';
import { aHoras, resumenDia } from '../../utils/horas';

/** Registro mensual de asistencia: resumen por trabajador y detalle por día (base de la planilla). */
@Component({
  selector: 'app-registro',
  template: `
    @let t = totales();
    <section class="lg-kpis">
      <div class="lg-kpi"><small><i class="pi pi-calendar"></i> Días laborables del mes</small><strong>{{ diasLaborables() }}</strong><span class="pie">Lunes a sábado hasta hoy</span></div>
      <div class="lg-kpi"><small><i class="pi pi-clock"></i> Horas trabajadas (todos)</small><strong>{{ aHoras(t.trabajados) }}</strong><span class="pie">Sin contar refrigerio</span></div>
      <div class="lg-kpi"><small><i class="pi pi-plus-circle"></i> Horas extra</small><strong>{{ aHoras(t.extra25 + t.extra35) }}</strong><span class="pie">{{ aHoras(t.extra25) }} al 25 % · {{ aHoras(t.extra35) }} al 35 %</span></div>
      <div class="lg-kpi"><small><i class="pi pi-exclamation-triangle"></i> Tardanzas</small><strong>{{ t.tardanzas }}</strong><span class="pie">{{ t.minTarde }} min en total</span></div>
    </section>

    <div class="lg-toolbar">
      <strong class="mes" style="display: inline-block">{{ nombreMes }}</strong>
      <span class="espacio"></span>
      <button type="button" class="lg-cta lg-cta--suave" (click)="exportar()"><i class="pi pi-download"></i> Registro del mes (CSV)</button>
    </div>

    <div class="rejilla">
      <section class="lg-card lg-scroll">
        <table class="lg-tabla">
          <thead>
            <tr><th>Trabajador</th><th class="num">Días</th><th class="num">Faltas</th><th class="num">Tardanzas</th><th class="num">Normales</th><th class="num">Extra 25 %</th><th class="num">Extra 35 %</th></tr>
          </thead>
          <tbody>
            @for (f of filas(); track f.t.id) {
              <tr class="clic" [class.sel]="elegido() === f.t.id" (click)="elegido.set(f.t.id)">
                <td><strong>{{ f.t.nombre }}</strong><small class="sub">{{ f.t.cargo }}</small></td>
                <td class="num">{{ f.dias }}</td>
                <td class="num" [class.lg-neg]="f.faltas > 0">{{ f.faltas }}</td>
                <td class="num">{{ f.tardanzas }}{{ f.minTarde ? ' (' + f.minTarde + ' min)' : '' }}</td>
                <td class="num lg-mono">{{ aHoras(f.normales) }}</td>
                <td class="num lg-mono">{{ aHoras(f.extra25) }}</td>
                <td class="num lg-mono">{{ aHoras(f.extra35) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>

      <section class="lg-card lg-scroll">
        @if (detalle(); as d) {
          <div class="lg-card__head"><div><h3>{{ d.nombre }}</h3><p>Detalle por día</p></div></div>
          <table class="lg-tabla">
            <thead><tr><th>Día</th><th>Entrada</th><th>Salida</th><th class="num">Horas</th><th>Nota</th></tr></thead>
            <tbody>
              @for (x of d.dias; track x.fecha) {
                <tr>
                  <td>{{ x.fecha.slice(8) }}/{{ x.fecha.slice(5, 7) }}</td>
                  <td class="lg-mono">{{ x.entrada ?? '—' }}</td>
                  <td class="lg-mono">{{ x.salida ?? '—' }}</td>
                  <td class="num lg-mono">{{ x.horas }}</td>
                  <td>
                    @if (x.falta) { <span class="lg-chip agotado">Falta</span> }
                    @if (x.tarde) { <span class="lg-chip bajo">Tarde {{ x.tarde }} min</span> }
                    @if (x.extra) { <span class="lg-chip ok">+{{ x.extra }} extra</span> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>
    </div>
    <p class="nota"><i class="pi pi-info-circle"></i> Este registro alimenta la planilla (PLAME). Las horas extra solo se pagan si fueron autorizadas; el sistema las calcula desde los 10 minutos.</p>
  `,
  styles: `
    .mes::first-letter { text-transform: uppercase; }
    .rejilla { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 1rem; align-items: start; }
    @media (max-width: 1400px) { .rejilla { grid-template-columns: 1fr; } }
    .sub { display: block; font-size: 0.75rem; color: var(--lg-muted); }
    .clic { cursor: pointer; }
    .sel td { background: #eff6ff; }
    .nota { display: flex; gap: 0.5rem; margin-top: 1rem; font-size: 0.84rem; color: var(--lg-muted); }
  `,
})
export class Registro {
  protected readonly sim = inject(AsistenciaSim);
  protected readonly aHoras = aHoras;
  protected readonly elegido = signal('t1');
  protected readonly nombreMes = new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  /** Fechas laborables del mes hasta hoy (lunes a sábado). */
  protected readonly fechas = computed(() => {
    const h = new Date();
    const lista: string[] = [];
    for (let d = 1; d <= h.getDate(); d++) {
      const f = new Date(h.getFullYear(), h.getMonth(), d);
      if (f.getDay() !== 0) lista.push(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return lista;
  });
  protected readonly diasLaborables = computed(() => this.fechas().length);

  protected readonly filas = computed(() => {
    const h = this.sim.horario();
    const marcas = this.sim.marcas();
    const hoyStr = this.fechas().at(-1);
    return this.sim.trabajadores().map((t) => {
      const suyas = marcas.filter((m) => m.trabajadorId === t.id);
      const acc = { dias: 0, faltas: 0, tardanzas: 0, minTarde: 0, normales: 0, extra25: 0, extra35: 0, trabajados: 0 };
      for (const f of this.fechas()) {
        const m = suyas.find((x) => x.fecha === f);
        if (!m) {
          if (f !== hoyStr) acc.faltas++;
          continue;
        }
        const r = resumenDia(m, h);
        acc.dias++;
        if (r.tardanza) {
          acc.tardanzas++;
          acc.minTarde += r.tardanza;
        }
        acc.normales += r.normales;
        acc.extra25 += r.extra25;
        acc.extra35 += r.extra35;
        acc.trabajados += r.trabajados;
      }
      return { t, ...acc };
    });
  });

  protected readonly totales = computed(() =>
    this.filas().reduce(
      (s, f) => ({
        trabajados: s.trabajados + f.trabajados,
        extra25: s.extra25 + f.extra25,
        extra35: s.extra35 + f.extra35,
        tardanzas: s.tardanzas + f.tardanzas,
        minTarde: s.minTarde + f.minTarde,
      }),
      { trabajados: 0, extra25: 0, extra35: 0, tardanzas: 0, minTarde: 0 },
    ),
  );

  protected readonly detalle = computed(() => {
    const t = this.sim.trabajador(this.elegido());
    if (!t) return null;
    const h = this.sim.horario();
    const hoyStr = this.fechas().at(-1);
    const dias = [...this.fechas()].reverse().map((fecha) => {
      const m = this.sim.marcaDe(t.id, fecha);
      const r = m ? resumenDia(m, h) : null;
      return {
        fecha,
        entrada: m?.entrada,
        salida: m?.salida,
        horas: r && m?.salida ? aHoras(r.trabajados) : '—',
        falta: !m && fecha !== hoyStr,
        tarde: r?.tardanza ?? 0,
        extra: r && r.extra25 + r.extra35 ? aHoras(r.extra25 + r.extra35) : '',
      };
    });
    return { nombre: t.nombre, dias };
  });

  protected exportar() {
    const h = this.sim.horario();
    const filas = this.sim.marcas().map((m) => {
      const t = this.sim.trabajador(m.trabajadorId);
      const r = resumenDia(m, h);
      return {
        DNI: t?.dni ?? '',
        Trabajador: t?.nombre ?? '',
        Fecha: m.fecha,
        Ingreso: m.entrada ?? '',
        Salida: m.salida ?? '',
        'Forma de marcar': m.metodo,
        Lugar: m.lugar,
        'Horas trabajadas': aHoras(r.trabajados),
        'Tardanza (min)': r.tardanza,
        'Extra 25 %': aHoras(r.extra25),
        'Extra 35 %': aHoras(r.extra35),
      };
    });
    descargarCsv(filas, `registro-asistencia-${this.fechas()[0]?.slice(0, 7)}.csv`);
  }
}
