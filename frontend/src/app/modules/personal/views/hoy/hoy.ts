import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { MetodoMarca } from '../../models/personal.model';
import { AsistenciaSim, LUGAR_OFICINA } from '../../services/asistencia-sim.service';
import { aHoras, resumenDia } from '../../utils/horas';

const METODOS: Record<MetodoMarca, { nombre: string; icono: string }> = {
  gps: { nombre: 'Celular + GPS', icono: 'pi pi-map-marker' },
  qr: { nombre: 'Código de oficina', icono: 'pi pi-qrcode' },
  manual: { nombre: 'Manual (supervisor)', icono: 'pi pi-user-edit' },
};

const AUSENCIAS: Record<string, string> = {
  descanso_medico: 'Descanso médico',
  vacaciones: 'Vacaciones',
  permiso: 'Permiso',
  licencia: 'Licencia',
};

/** Panel del día: estado de cada trabajador según su marca. */
@Component({
  selector: 'app-asistencia-hoy',
  imports: [RouterLink],
  template: `
    @let k = kpis();
    <section class="lg-kpis">
      <div class="lg-kpi" style="--c: #10b981"><span class="icono"><i class="pi pi-check"></i></span><small>Presentes</small><strong>{{ k.presentes }} / {{ k.total }}</strong><span class="pie">Marcaron entrada hoy</span></div>
      <div class="lg-kpi" style="--c: #3b82f6"><span class="icono"><i class="pi pi-map-marker"></i></span><small>En campo</small><strong>{{ k.campo }}</strong><span class="pie">Marcaron en la obra del cliente</span></div>
      <div class="lg-kpi" style="--c: #f59e0b"><span class="icono"><i class="pi pi-clock"></i></span><small>Tardanzas</small><strong>{{ k.tarde }}</strong><span class="pie">Después de {{ sim.horario().entrada }} + {{ sim.horario().tolerancia }} min</span></div>
      <div class="lg-kpi" style="--c: #ef4444"><span class="icono"><i class="pi pi-user-minus"></i></span><small>Sin marcar</small><strong>{{ k.faltan }}</strong><span class="pie">{{ k.justificados }} con justificación</span></div>
    </section>

    <div class="lg-toolbar">
      <span class="lg-chip" [class]="sim.horario().oficina ? 'ok' : 'critico'">{{ oficina() }}</span>
      <span class="espacio"></span>
      <a class="lg-cta lg-cta--suave" routerLink="/personal/registro"><i class="pi pi-calendar"></i> Registro del mes</a>
      <a class="lg-cta" routerLink="/personal/marcar"><i class="pi pi-mobile"></i> Probar cómo marca un trabajador</a>
    </div>

    @if (sim.porAprobar().length) {
      <section class="lg-card pendientes">
        <div class="lg-card__head"><div><h3>Marcas por aprobar</h3><p>Registradas sin GPS por el propio trabajador</p></div></div>
        @for (p of sim.porAprobar(); track p.trabajadorId + p.fecha) {
          <div class="pend">
            <span class="lg-avatar">{{ iniciales(sim.trabajador(p.trabajadorId)?.nombre ?? '') }}</span>
            <div class="crece">
              <strong>{{ sim.trabajador(p.trabajadorId)?.nombre }}</strong>
              <small>{{ p.fecha.slice(8) }}/{{ p.fecha.slice(5, 7) }} · entrada {{ p.entrada ?? '—' }} · salida {{ p.salida ?? '—' }} · "{{ p.motivoManual }}"</small>
            </div>
            <button type="button" class="lg-cta" (click)="sim.aprobar(p.trabajadorId, p.fecha)"><i class="pi pi-check"></i> Aprobar</button>
          </div>
        }
      </section>
    }

    <section class="lg-card lg-scroll">
      <table class="lg-tabla">
        <thead><tr><th>Trabajador</th><th>Estado</th><th>Entrada</th><th>Salida</th><th>Cómo marcó</th><th>Dónde</th></tr></thead>
        <tbody>
          @for (f of filas(); track f.t.id) {
            <tr>
              <td><span class="persona"><span class="lg-avatar">{{ iniciales(f.t.nombre) }}</span><span><strong>{{ f.t.nombre }}</strong><small>{{ f.t.cargo }}</small></span></span></td>
              <td><span class="lg-chip" [class]="f.clase">{{ f.estado }}</span></td>
              <td class="lg-mono">{{ f.m?.entrada ?? '—' }}</td>
              <td class="lg-mono">{{ f.m?.salida ?? '—' }}</td>
              <td>
                @if (f.m; as m) {
                  <i [class]="metodos[m.metodo].icono"></i> {{ metodos[m.metodo].nombre }}
                }
              </td>
              <td><small>{{ f.m?.lugar ?? '' }}</small></td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
  styles: `
    .persona { display: flex; gap: 0.6rem; align-items: center; }
    .persona strong { display: block; font-size: 0.88rem; }
    .persona small, td small { color: var(--lg-muted); font-size: 0.76rem; }
    .pendientes { margin-bottom: 1rem; border-color: #fde68a; background: #fffdf5; }
    .pend { display: flex; gap: 0.7rem; align-items: center; padding: 0.55rem 0; border-top: 1px solid var(--lg-line); }
    .pend strong { display: block; font-size: 0.88rem; }
    .pend small { color: var(--lg-muted); font-size: 0.78rem; }
    .crece { flex: 1; min-width: 0; }
  `,
})
export class AsistenciaHoy {
  protected readonly sim = inject(AsistenciaSim);
  protected readonly metodos = METODOS;
  protected readonly oficina = computed(() => (this.sim.horario().oficina ? 'Ubicación de la oficina fijada' : 'Falta fijar la ubicación de la oficina'));

  protected readonly filas = computed(() => {
    const h = this.sim.horario();
    const ausencias = this.sim.ausencias();
    return this.sim.trabajadores().map((t) => {
      const m = this.sim.marcaDe(t.id);
      const a = ausencias.find((x) => x.trabajadorId === t.id && !m);
      let estado = 'Sin marcar';
      let clase = 'agotado';
      if (a) {
        estado = AUSENCIAS[a.tipo];
        clase = 'sin-punto';
      } else if (m) {
        const r = resumenDia(m, h);
        estado = m.salida
          ? `Salió${m.salidaEnCampo ? ' en campo' : ''} · ${aHoras(r.trabajados)} h`
          : r.tardanza
            ? `Tarde (${r.tardanza} min)`
            : 'Presente';
        clase = r.tardanza && !m.salida ? 'bajo' : 'ok';
        if (m.pendiente) {
          estado = 'Por aprobar (sin GPS)';
          clase = 'critico';
        }
      }
      return { t, m, estado, clase };
    });
  });

  protected readonly kpis = computed(() => {
    const f = this.filas();
    const h = this.sim.horario();
    return {
      total: f.length,
      presentes: f.filter((x) => x.m).length,
      campo: f.filter((x) => x.m && x.m.lugar !== LUGAR_OFICINA).length,
      tarde: f.filter((x) => x.m && resumenDia(x.m, h).tardanza > 0).length,
      faltan: f.filter((x) => !x.m).length,
      justificados: f.filter((x) => !x.m && x.clase === 'sin-punto').length,
    };
  });

  protected iniciales(nombre: string) {
    return nombre.split(' ').map((p) => p[0]).slice(0, 2).join('');
  }
}
