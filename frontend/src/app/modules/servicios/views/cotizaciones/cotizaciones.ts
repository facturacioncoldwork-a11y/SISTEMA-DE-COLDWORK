import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { dinero, hoy } from '../../../finanzas/utils/calculos';
import type { Cotizacion, SerieCotizacion } from '../../models/cotizacion.model';
import { CotizacionesSim } from '../../services/cotizaciones-sim.service';
import { ServiciosSim } from '../../services/servicios-sim.service';
import { totalesCotizacion, venceEl } from '../../utils/cotizacion';

type Filtro = 'todas' | 'borrador' | 'enviada' | 'vencida' | 'aprobada' | 'rechazada';

const ESTADOS: Record<string, { nombre: string; clase: string }> = {
  borrador: { nombre: 'Borrador', clase: 'sin-punto' },
  enviada: { nombre: 'Enviada', clase: 'bajo' },
  vencida: { nombre: 'Vencida', clase: 'critico' },
  aprobada: { nombre: 'Aprobada', clase: 'ok' },
  rechazada: { nombre: 'Rechazada', clase: 'agotado' },
};

/** Lista de cotizaciones con su estado (enviada, vencida, aprobada…). */
@Component({
  selector: 'app-cotizaciones',
  imports: [FormsModule, RouterLink],
  template: `
    @let k = kpis();
    <section class="lg-kpis">
      <div class="lg-kpi" style="--c: #64748b"><span class="icono"><i class="pi pi-pencil"></i></span><small>Borradores</small><strong>{{ k.borradores }}</strong><span class="pie">Aún sin enviar</span></div>
      <div class="lg-kpi" style="--c: #f59e0b"><span class="icono"><i class="pi pi-hourglass"></i></span><small>Esperando respuesta</small><strong>{{ k.enviadas }}</strong><span class="pie">{{ k.vencidas }} vencida{{ k.vencidas === 1 ? '' : 's' }} sin respuesta</span></div>
      <div class="lg-kpi" style="--c: #10b981"><span class="icono"><i class="pi pi-check"></i></span><small>Aprobadas</small><strong>{{ k.aprobadas }}</strong><span class="pie">Pasaron a servicios en curso</span></div>
      <div class="lg-kpi" style="--c: #3b82f6"><span class="icono"><i class="pi pi-percentage"></i></span><small>Tasa de aprobación</small><strong>{{ k.tasa === null ? '—' : k.tasa + ' %' }}</strong><span class="pie">Aprobadas / respondidas</span></div>
    </section>

    <div class="lg-toolbar">
      <label class="lg-buscar">
        <i class="pi pi-search"></i>
        <input type="text" placeholder="Buscar por número, cliente o proyecto" [ngModel]="texto()" (ngModelChange)="texto.set($event)" aria-label="Buscar cotizaciones" />
      </label>
      <div class="lg-seg" role="group" aria-label="Estado">
        @for (f of filtros; track f.valor) {
          <button type="button" [class.on]="filtro() === f.valor" (click)="filtro.set(f.valor)">{{ f.nombre }}</button>
        }
      </div>
      <span class="espacio"></span>
      <button type="button" class="lg-cta lg-cta--suave" (click)="crear('SERV')"><i class="pi pi-wrench"></i> Cotizar servicio</button>
      <button type="button" class="lg-cta" (click)="crear('PROY')"><i class="pi pi-plus"></i> Cotizar proyecto</button>
    </div>

    <section class="lg-card lg-scroll">
      <table class="lg-tabla">
        <thead><tr><th>Cotización</th><th>Cliente / proyecto</th><th>Fecha</th><th>Vence</th><th class="num">Total (con IGV)</th><th>Estado</th></tr></thead>
        <tbody>
          @for (c of visibles(); track c.id) {
            @let e = estadoDe(c);
            <tr class="clic" [routerLink]="['/proyectos/cotizaciones', c.id]">
              <td><strong class="lg-mono">{{ c.numero }}</strong><small class="sub">{{ c.serie === 'PROY' ? 'Proyecto' : 'Servicio' }} · {{ c.moneda === 'USD' ? 'US$' : 'S/' }}</small></td>
              <td>{{ servicios.cliente(c.clienteId)?.razonSocial ?? 'Sin cliente' }}<small class="sub">{{ c.proyecto || '—' }}</small></td>
              <td>{{ fechaPe(c.fecha) }}</td>
              <td [class.lg-neg]="e === 'vencida'">{{ fechaPe(vence(c)) }}</td>
              <td class="num"><strong>{{ dinero(total(c), c.moneda) }}</strong></td>
              <td><span class="lg-chip" [class]="estados[e].clase">{{ estados[e].nombre }}</span></td>
            </tr>
          } @empty {
            <tr><td colspan="6"><div class="lg-vacio"><i class="pi pi-file-edit"></i><h4>Sin cotizaciones con ese filtro</h4></div></td></tr>
          }
        </tbody>
      </table>
    </section>
  `,
  styles: `
    .sub { display: block; font-size: 0.75rem; color: var(--lg-muted); }
    .clic { cursor: pointer; }
    .clic:hover td { background: var(--lg-soft); }
  `,
})
export class Cotizaciones {
  protected readonly sim = inject(CotizacionesSim);
  protected readonly servicios = inject(ServiciosSim);
  private readonly router = inject(Router);

  protected readonly estados = ESTADOS;
  protected readonly dinero = dinero;
  protected readonly filtro = signal<Filtro>('todas');
  protected readonly texto = signal('');
  protected readonly filtros: { valor: Filtro; nombre: string }[] = [
    { valor: 'todas', nombre: 'Todas' },
    { valor: 'borrador', nombre: 'Borradores' },
    { valor: 'enviada', nombre: 'Enviadas' },
    { valor: 'vencida', nombre: 'Vencidas' },
    { valor: 'aprobada', nombre: 'Aprobadas' },
    { valor: 'rechazada', nombre: 'Rechazadas' },
  ];

  /** "Vencida" = enviada y pasó su validez sin respuesta. */
  protected estadoDe(c: Cotizacion): string {
    return c.estado === 'enviada' && venceEl(c) < hoy() ? 'vencida' : c.estado;
  }

  protected readonly kpis = computed(() => {
    const l = this.sim.cotizaciones();
    const aprobadas = l.filter((c) => c.estado === 'aprobada').length;
    const rechazadas = l.filter((c) => c.estado === 'rechazada').length;
    return {
      borradores: l.filter((c) => c.estado === 'borrador').length,
      enviadas: l.filter((c) => c.estado === 'enviada').length,
      vencidas: l.filter((c) => this.estadoDe(c) === 'vencida').length,
      aprobadas,
      tasa: aprobadas + rechazadas ? Math.round((aprobadas / (aprobadas + rechazadas)) * 100) : null,
    };
  });

  protected readonly visibles = computed(() => {
    const f = this.filtro();
    const t = this.texto().trim().toLowerCase();
    return this.sim
      .cotizaciones()
      .filter((c) => f === 'todas' || this.estadoDe(c) === f)
      .filter((c) => !t || `${c.numero} ${c.proyecto} ${this.servicios.cliente(c.clienteId)?.razonSocial ?? ''}`.toLowerCase().includes(t));
  });

  protected total(c: Cotizacion) {
    return totalesCotizacion(c).total;
  }
  protected vence(c: Cotizacion) {
    return venceEl(c);
  }
  protected fechaPe(f: string) {
    return f.split('-').reverse().join('/');
  }

  protected crear(serie: SerieCotizacion) {
    const c = this.sim.nueva(serie);
    void this.router.navigate(['/proyectos/cotizaciones', c.id]);
  }
}
