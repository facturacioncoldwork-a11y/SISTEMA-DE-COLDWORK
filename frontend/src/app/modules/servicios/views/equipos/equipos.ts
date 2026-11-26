import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ESTADOS_ORDEN, TIPOS_EQUIPO, TIPOS_SERVICIO } from '../../data/catalogos';
import { ServiciosStore } from '../../services/servicios-store.service';

/** Equipos de los clientes con su hoja de vida (historial de servicios). */
@Component({
  selector: 'app-equipos',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="lg-toolbar">
      <label class="lg-buscar">
        <i class="pi pi-search"></i>
        <input type="text" placeholder="Buscar por código, cliente, marca o serie" [ngModel]="texto()" (ngModelChange)="texto.set($event)" aria-label="Buscar equipos" />
      </label>
      <span class="espacio"></span>
      <button type="button" class="lg-cta" (click)="formulario.set(!formulario())"><i class="pi pi-plus"></i> Nuevo equipo</button>
    </div>

    @if (formulario()) {
      <section class="lg-card nuevo">
        <div class="lg-card__head"><div><h3>Nuevo equipo de cliente</h3><p>Los clientes salen de Finanzas · Clientes y proveedores</p></div></div>
        @if (!sim.clientes().length) {
          <p class="vacio">Aún no tienes clientes: regístralos en Finanzas · Clientes y proveedores.</p>
        } @else {
          <form class="campos" (ngSubmit)="guardar()">
            <label>Cliente
              <select name="cli" [(ngModel)]="nuevo.clienteId">
                <option value="">Elige el cliente</option>
                @for (c of sim.clientes(); track c.id) { <option [value]="c.id">{{ c.razonSocial }}</option> }
              </select>
            </label>
            <label>Código interno<input name="cod" placeholder="Ej. CF-01" [(ngModel)]="nuevo.codigo" /></label>
            <label>Tipo
              <select name="tipo" [(ngModel)]="nuevo.tipo">
                @for (t of tiposEquipo; track t) { <option [value]="t">{{ t }}</option> }
              </select>
            </label>
            <label>Marca<input name="marca" [(ngModel)]="nuevo.marca" /></label>
            <label>Modelo<input name="modelo" [(ngModel)]="nuevo.modelo" /></label>
            <label>N.° de serie<input name="serie" [(ngModel)]="nuevo.serie" /></label>
            <label>Refrigerante<input name="ref" placeholder="Ej. R-404A" [(ngModel)]="nuevo.refrigerante" /></label>
            <label>Capacidad<input name="cap" placeholder="Ej. 12 HP" [(ngModel)]="nuevo.capacidad" /></label>
            <label>Ubicación<input name="ubi" placeholder="Ej. Packing · cámara 1" [(ngModel)]="nuevo.ubicacion" /></label>
            <div class="acc"><button type="submit" class="lg-cta"><i class="pi pi-check"></i> Guardar equipo</button></div>
          </form>
        }
      </section>
    }

    <div class="rejilla">
      <section class="lg-card lg-scroll">
        <table class="lg-tabla">
          <thead><tr><th>Equipo</th><th>Cliente</th><th>Refrigerante</th><th class="num">Servicios</th></tr></thead>
          <tbody>
            @for (e of visibles(); track e.id) {
              <tr class="clic" [class.sel]="elegido() === e.id" (click)="elegido.set(e.id)">
                <td><strong class="lg-mono">{{ e.codigo }}</strong><small class="sub">{{ e.tipo }} · {{ e.marca }} {{ e.modelo }}</small></td>
                <td>{{ sim.cliente(e.clienteId)?.razonSocial }}<small class="sub">{{ e.ubicacion }}</small></td>
                <td>{{ e.refrigerante }} · {{ e.capacidad }}</td>
                <td class="num">{{ servicios(e.id).length }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>

      <section class="lg-card">
        @if (equipo(); as e) {
          <div class="lg-card__head">
            <div><h3>Hoja de vida · {{ e.codigo }}</h3><p>Serie {{ e.serie }} · {{ sim.cliente(e.clienteId)?.razonSocial }}</p></div>
          </div>
          <ol class="historia">
            @for (o of servicios(e.id); track o.id) {
              <li>
                <a [routerLink]="['/servicios/ordenes', o.id]">
                  <span class="lg-chip" [class]="estados[o.estado].clase">{{ estados[o.estado].nombre }}</span>
                  <strong>{{ o.numero }} · {{ tipos[o.tipo].nombre }}</strong>
                  <small>{{ o.fecha }} · {{ o.informe.diagnostico || o.descripcion }}</small>
                </a>
              </li>
            } @empty {
              <li class="vacio">Aún sin servicios</li>
            }
          </ol>
        } @else {
          <div class="lg-vacio"><i class="pi pi-server"></i><h4>Elige un equipo</h4><p>Verás todos sus servicios e informes.</p></div>
        }
      </section>
    </div>
  `,
  styles: `
    .rejilla { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 1rem; align-items: start; }
    @media (max-width: 960px) { .rejilla { grid-template-columns: 1fr; } }
    .sub { display: block; font-size: 0.75rem; color: var(--lg-muted); }
    .clic { cursor: pointer; }
    .sel td { background: #eff6ff; }
    .historia { list-style: none; margin: 0; padding: 0; border-left: 2px solid var(--lg-line); }
    .historia li { padding: 0 0 0.9rem 1rem; position: relative; }
    .historia li::before { content: ''; position: absolute; left: -0.4rem; top: 0.3rem; width: 0.65rem; height: 0.65rem; border-radius: 50%; background: var(--lg-blue); }
    .historia a { color: inherit; text-decoration: none; display: flex; flex-direction: column; gap: 0.2rem; }
    .historia strong { font-size: 0.88rem; }
    .historia small { color: var(--lg-muted); font-size: 0.78rem; }
    .vacio { color: var(--lg-muted); font-style: italic; }
    .nuevo { margin-bottom: 1rem; }
    .campos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.7rem; }
    @media (max-width: 760px) { .campos { grid-template-columns: 1fr; } }
    .campos label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.78rem; color: var(--lg-muted); }
    .campos input, .campos select { padding: 0.5rem 0.6rem; border: 1px solid var(--lg-line); border-radius: 0.55rem; font: inherit; font-size: 0.88rem; background: #fff; }
    .campos .acc { grid-column: 1 / -1; display: flex; justify-content: flex-end; }
  `,
})
export class Equipos {
  protected readonly sim = inject(ServiciosStore);
  protected readonly estados = ESTADOS_ORDEN;
  protected readonly tipos = TIPOS_SERVICIO;
  private readonly avisos = inject(MessageService);
  protected readonly texto = signal('');
  protected readonly elegido = signal<string | null>(null);
  protected readonly formulario = signal(false);
  protected readonly tiposEquipo = TIPOS_EQUIPO;
  protected nuevo = this.vacio();

  private vacio() {
    return { clienteId: '', codigo: '', tipo: TIPOS_EQUIPO[0], marca: '', modelo: '', serie: '', refrigerante: '', capacidad: '', ubicacion: '' };
  }

  protected guardar() {
    if (!this.nuevo.clienteId || this.nuevo.codigo.trim().length < 2) {
      this.avisos.add({ severity: 'warn', summary: 'Falta un dato', detail: 'Elige el cliente y escribe un código para el equipo.', life: 4000 });
      return;
    }
    const e = this.sim.agregarEquipo({ ...this.nuevo, codigo: this.nuevo.codigo.trim().toUpperCase() });
    this.elegido.set(e.id);
    this.nuevo = this.vacio();
    this.formulario.set(false);
  }

  protected readonly visibles = computed(() => {
    const t = this.texto().trim().toLowerCase();
    return this.sim
      .equipos()
      .filter((e) => !t || `${e.codigo} ${e.tipo} ${e.marca} ${e.serie} ${this.sim.cliente(e.clienteId)?.razonSocial}`.toLowerCase().includes(t));
  });

  protected readonly equipo = computed(() => this.sim.equipo(this.elegido() ?? ''));

  protected servicios(equipoId: string) {
    return this.sim.ordenes().filter((o) => o.equipoId === equipoId);
  }
}
