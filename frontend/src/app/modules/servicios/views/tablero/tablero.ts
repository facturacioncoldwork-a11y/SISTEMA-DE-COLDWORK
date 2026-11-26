import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { OrdenDialogo } from '../../components/orden-dialogo/orden-dialogo';
import { ESTADOS_ORDEN, PRIORIDADES, TIPOS_SERVICIO } from '../../data/catalogos';
import type { EstadoOrden, OrdenTrabajo } from '../../models/servicios.model';
import { ServiciosStore } from '../../services/servicios-store.service';

/** Tablero del día: órdenes por estado, filtro por técnico y alta de nuevas órdenes. */
@Component({
  selector: 'app-tablero',
  imports: [RouterLink, OrdenDialogo],
  templateUrl: './tablero.html',
  styleUrl: './tablero.scss',
})
export class Tablero {
  protected readonly sim = inject(ServiciosStore);
  private readonly avisos = inject(MessageService);

  protected readonly estados = ESTADOS_ORDEN;
  protected readonly prioridades = PRIORIDADES;
  protected readonly tipos = TIPOS_SERVICIO;
  protected readonly columnas: EstadoOrden[] = ['programada', 'en_curso', 'por_firmar', 'cerrada'];

  protected readonly tecnico = signal<string | null>(null);
  protected readonly dialogo = signal(false);

  protected readonly filtradas = computed(() => {
    const t = this.tecnico();
    const grupos = this.sim.porEstado();
    const f = (l: OrdenTrabajo[]) => (t ? l.filter((o) => o.tecnicos.includes(t)) : l);
    return {
      programada: f(grupos.programada),
      en_curso: f(grupos.en_curso),
      por_firmar: f(grupos.por_firmar),
      cerrada: f(grupos.cerrada),
    } as Record<EstadoOrden, OrdenTrabajo[]>;
  });

  protected readonly kpis = computed(() => {
    const l = this.sim.ordenes();
    return {
      total: l.length,
      enCurso: l.filter((o) => o.estado === 'en_curso').length,
      porFirmar: l.filter((o) => o.estado === 'por_firmar').length,
      urgentes: l.filter((o) => o.prioridad === 'urgente' && o.estado !== 'cerrada').length,
    };
  });

  protected iniciales(id: string) {
    return (this.sim.tecnico(id)?.nombre ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('');
  }

  protected creada(o: OrdenTrabajo) {
    this.avisos.add({ severity: 'success', summary: `${o.numero} creada`, detail: 'Los técnicos asignados la verán en su celular (simulado).', life: 4000 });
  }
}
