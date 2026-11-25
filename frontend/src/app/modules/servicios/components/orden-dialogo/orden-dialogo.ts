import { Component, computed, effect, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { hoy } from '../../../finanzas/utils/calculos';
import { PRIORIDADES, TIPOS_SERVICIO } from '../../data/catalogos';
import type { OrdenTrabajo, Prioridad, TipoServicio } from '../../models/servicios.model';
import { ServiciosSim } from '../../services/servicios-sim.service';

/** Nueva orden de trabajo: cliente, equipo, tipo, prioridad y técnicos asignados. */
@Component({
  selector: 'app-orden-dialogo',
  imports: [FormsModule, DialogModule, InputTextModule, SelectModule, TextareaModule],
  template: `
    <p-dialog [(visible)]="visible" [modal]="true" [draggable]="false" [style]="{ width: 'min(44rem, 96vw)' }" header="Nueva orden de trabajo">
      <form class="lg-form" (ngSubmit)="guardar()">
        <div>
          <label for="ot-cli">Cliente</label>
          <p-select inputId="ot-cli" name="cli" [options]="sim.clientes()" optionLabel="razonSocial" optionValue="id" [filter]="true" appendTo="body"
            placeholder="Elige el cliente" [ngModel]="clienteId()" (ngModelChange)="clienteId.set($event); equipoId = null" />
        </div>
        <div>
          <label for="ot-eq">Equipo</label>
          <p-select inputId="ot-eq" name="eq" [options]="equipos()" optionLabel="etiqueta" optionValue="id" appendTo="body"
            [placeholder]="clienteId() ? 'Elige el equipo' : 'Primero el cliente'" [(ngModel)]="equipoId" />
        </div>
        <div>
          <label for="ot-tipo">Tipo de servicio</label>
          <p-select inputId="ot-tipo" name="tipo" [options]="tipos" optionLabel="nombre" optionValue="valor" appendTo="body" [(ngModel)]="tipo" />
        </div>
        <div>
          <label for="ot-pri">Prioridad</label>
          <p-select inputId="ot-pri" name="pri" [options]="prioridades" optionLabel="nombre" optionValue="valor" appendTo="body" [(ngModel)]="prioridad" />
        </div>
        <div>
          <label for="ot-fecha">Fecha</label>
          <input pInputText id="ot-fecha" name="fecha" type="date" [(ngModel)]="fecha" />
        </div>
        <div>
          <label for="ot-hora">Hora</label>
          <input pInputText id="ot-hora" name="hora" type="time" [(ngModel)]="hora" />
        </div>
        <div class="full">
          <span class="lbl">Técnicos asignados</span>
          <div class="tecnicos">
            @for (t of sim.tecnicos(); track t.id) {
              @let vencido = !!t.sctrHasta && t.sctrHasta < hoyStr;
              <button type="button" class="tec" [class.on]="asignados().has(t.id)" [disabled]="vencido" (click)="alternar(t.id)"
                [title]="vencido ? 'SCTR vencido: no puede ir a campo' : t.especialidad">
                <span class="lg-avatar">{{ iniciales(t.nombre) }}</span>
                <span><strong>{{ t.nombre }}</strong><small>{{ vencido ? 'SCTR vencido' : t.especialidad }}</small></span>
              </button>
            }
          </div>
        </div>
        <div class="full">
          <label for="ot-desc">Qué reportó el cliente</label>
          <textarea pTextarea id="ot-desc" name="desc" rows="3" [(ngModel)]="descripcion" placeholder="Ej. La cámara no baja de -10 °C"></textarea>
        </div>
        @if (error(); as e) {
          <p class="error"><i class="pi pi-exclamation-circle"></i> {{ e }}</p>
        }
        <div class="full lg-pie-dialogo">
          <button type="button" class="lg-cta lg-cta--suave" (click)="visible.set(false)">Cancelar</button>
          <button type="submit" class="lg-cta"><i class="pi pi-check"></i> Crear y asignar</button>
        </div>
      </form>
    </p-dialog>
  `,
  styles: `
    .tecnicos { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 0.5rem; }
    .tec { display: flex; gap: 0.6rem; align-items: center; padding: 0.55rem 0.7rem; border: 1.5px solid var(--lg-line);
      border-radius: 0.8rem; background: #fff; cursor: pointer; font: inherit; text-align: left; }
    .tec strong { display: block; font-size: 0.85rem; }
    .tec small { color: var(--lg-muted); font-size: 0.74rem; }
    .tec.on { border-color: var(--lg-blue); background: #eff6ff; }
    .tec:disabled { opacity: 0.5; cursor: not-allowed; }
    textarea { width: 100%; }
  `,
})
export class OrdenDialogo {
  protected readonly sim = inject(ServiciosSim);
  readonly visible = model(false);
  readonly creada = output<OrdenTrabajo>();

  protected readonly hoyStr = hoy();
  protected readonly tipos = (Object.keys(TIPOS_SERVICIO) as TipoServicio[]).map((valor) => ({ valor, nombre: TIPOS_SERVICIO[valor].nombre }));
  protected readonly prioridades = (Object.keys(PRIORIDADES) as Prioridad[]).map((valor) => ({ valor, nombre: PRIORIDADES[valor].nombre }));

  protected readonly clienteId = signal<string | null>(null);
  protected equipoId: string | null = null;
  protected tipo: TipoServicio = 'preventivo';
  protected prioridad: Prioridad = 'media';
  protected fecha = hoy();
  protected hora = '09:00';
  protected descripcion = '';
  protected readonly asignados = signal(new Set<string>());
  protected readonly error = signal<string | null>(null);

  protected readonly equipos = computed(() =>
    this.sim
      .equipos()
      .filter((e) => e.clienteId === this.clienteId())
      .map((e) => ({ id: e.id, etiqueta: `${e.codigo} · ${e.tipo} ${e.marca}` })),
  );

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      this.clienteId.set(null);
      this.equipoId = null;
      this.descripcion = '';
      this.asignados.set(new Set());
      this.error.set(null);
    });
  }

  protected alternar(id: string) {
    this.asignados.update((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  protected iniciales(nombre: string) {
    return nombre.split(' ').map((p) => p[0]).slice(0, 2).join('');
  }

  protected guardar() {
    if (!this.clienteId() || !this.equipoId) return this.error.set('Elige el cliente y el equipo.');
    if (!this.asignados().size) return this.error.set('Asigna al menos un técnico.');
    const ot = this.sim.crear({
      clienteId: this.clienteId()!,
      equipoId: this.equipoId,
      tipo: this.tipo,
      prioridad: this.prioridad,
      tecnicos: [...this.asignados()],
      fecha: this.fecha,
      hora: this.hora,
      descripcion: this.descripcion.trim(),
    });
    this.creada.emit(ot);
    this.visible.set(false);
  }
}
