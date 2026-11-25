import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import type { Horario } from '../../models/personal.model';
import { AsistenciaSim } from '../../services/asistencia-sim.service';

/** Horario de la empresa y formas de marcar permitidas (solo dueño o administración). */
@Component({
  selector: 'app-horario',
  imports: [FormsModule],
  template: `
    @let h = borrador();
    <div class="rejilla">
      <section class="lg-card">
        <div class="lg-card__head"><div><h3>Jornada</h3><p>Máximo 8 h diarias y 48 h semanales</p></div></div>
        <form class="lg-form" (ngSubmit)="guardar()">
          <div><label for="h-ent">Hora de entrada</label><input id="h-ent" name="ent" type="time" [(ngModel)]="h.entrada" /></div>
          <div><label for="h-sal">Hora de salida</label><input id="h-sal" name="sal" type="time" [(ngModel)]="h.salida" /></div>
          <div><label for="h-refd">Almuerzan normalmente desde</label><input id="h-refd" name="refd" type="time" [(ngModel)]="h.refrigerioDesde" /></div>
          <div><label for="h-refh">hasta</label><input id="h-refh" name="refh" type="time" [(ngModel)]="h.refrigerioHasta" /></div>
          <div><label for="h-ref">Refrigerio (min)</label><input id="h-ref" name="ref" type="number" min="45" [(ngModel)]="h.refrigerio" /></div>
          <p class="full nota-ref">El refrigerio se descuenta por duración, sea a la hora que sea dentro de ese rango (a las 12, a la 1 o a las 2): nadie tiene que marcar salida ni regreso del almuerzo.</p>
          <div><label for="h-tol">Tolerancia (min)</label><input id="h-tol" name="tol" type="number" min="0" max="30" [(ngModel)]="h.tolerancia" /></div>
          @if (error(); as e) {
            <p class="error full"><i class="pi pi-exclamation-circle"></i> {{ e }}</p>
          }
          <div class="full lg-pie-dialogo"><button type="submit" class="lg-cta"><i class="pi pi-check"></i> Guardar horario</button></div>
        </form>
      </section>

      <section class="lg-card">
        <div class="lg-card__head"><div><h3>Formas de marcar</h3><p>Activa las que usará tu empresa</p></div></div>
        <ul class="opciones">
          <li><label><input type="checkbox" [(ngModel)]="h.metodos.gps" /> <span><b>Celular + GPS</b><small>Técnicos en campo y oficina</small></span></label></li>
          <li><label><input type="checkbox" [(ngModel)]="h.metodos.qr" /> <span><b>Código de la oficina</b><small>Tablet en la entrada, cambia cada 30 s</small></span></label></li>
          <li><label><input type="checkbox" [(ngModel)]="h.metodos.manual" /> <span><b>Manual por supervisor</b><small>Con motivo obligatorio</small></span></label></li>
          <li><label><input type="checkbox" [(ngModel)]="h.selfie" /> <span><b>Pedir selfie con el celular</b><small>Evita que otro marque por el trabajador</small></span></label></li>
        </ul>
        <label class="radio">Radio de la oficina: <b>{{ h.radioOficina }} m</b>
          <input type="range" min="50" max="500" step="10" [(ngModel)]="h.radioOficina" />
        </label>
      </section>
    </div>
  `,
  styles: `
    .rejilla { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; align-items: start; }
    @media (max-width: 900px) { .rejilla { grid-template-columns: 1fr; } }
    input[type='time'], input[type='number'] { width: 100%; padding: 0.55rem; border: 1px solid var(--lg-line); border-radius: 0.6rem; font: inherit; }
    .opciones { list-style: none; margin: 0 0 1rem; padding: 0; }
    .opciones li { padding: 0.55rem 0; border-top: 1px solid var(--lg-line); }
    .opciones label { display: flex; gap: 0.7rem; align-items: center; cursor: pointer; }
    .opciones b { display: block; font-size: 0.9rem; }
    .opciones small { color: var(--lg-muted); font-size: 0.78rem; }
    .opciones input { width: 1.1rem; height: 1.1rem; accent-color: var(--lg-blue); }
    .nota-ref { margin: 0; font-size: 0.8rem; color: var(--lg-muted); }
    .radio { display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.86rem; color: var(--lg-muted); }
  `,
})
export class HorarioView {
  private readonly sim = inject(AsistenciaSim);
  private readonly avisos = inject(MessageService);
  protected readonly borrador = signal<Horario>(structuredClone(this.sim.horario()));
  protected readonly error = signal<string | null>(null);

  protected guardar() {
    const h = this.borrador();
    const [he, me] = h.entrada.split(':').map(Number);
    const [hs, ms] = h.salida.split(':').map(Number);
    const jornada = hs * 60 + ms - (he * 60 + me) - h.refrigerio;
    if (h.refrigerio < 45) return this.error.set('El refrigerio mínimo es de 45 minutos.');
    if (jornada > 480) return this.error.set('La jornada ordinaria no puede pasar de 8 horas diarias.');
    if (jornada <= 0) return this.error.set('Revisa las horas de entrada y salida.');
    this.error.set(null);
    this.sim.guardarHorario({ ...h, jornada });
    this.avisos.add({ severity: 'success', summary: 'Horario guardado', detail: 'Se recalcularon tardanzas y horas extra (simulación).', life: 3500 });
  }
}
