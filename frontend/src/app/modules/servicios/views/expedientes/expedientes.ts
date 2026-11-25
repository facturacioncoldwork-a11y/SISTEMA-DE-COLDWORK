import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { dinero, hoy } from '../../../finanzas/utils/calculos';
import { ETAPAS, indiceEtapa } from '../../data/etapas';
import type { Expediente } from '../../models/expediente.model';
import { ExpedientesSim } from '../../services/expedientes-sim.service';
import { ServiciosSim } from '../../services/servicios-sim.service';

type Filtro = 'todos' | 'cliente' | 'materiales' | 'facturar' | 'cobrar';

/** Tablero del coordinador: todos los servicios en curso y qué falta en cada uno. */
@Component({
  selector: 'app-expedientes',
  imports: [FormsModule, RouterLink, DialogModule, InputTextModule, SelectModule, TextareaModule],
  templateUrl: './expedientes.html',
  styleUrl: './expedientes.scss',
})
export class Expedientes {
  protected readonly sim = inject(ExpedientesSim);
  protected readonly servicios = inject(ServiciosSim);
  private readonly router = inject(Router);

  protected readonly etapas = ETAPAS;
  protected readonly dinero = dinero;
  protected readonly filtro = signal<Filtro>('todos');
  protected readonly texto = signal('');

  // Nuevo expediente
  protected readonly dialogo = signal(false);
  protected nuevo = { clienteId: '', titulo: '', solicitud: '', responsableId: 'p1' };
  protected readonly error = signal<string | null>(null);

  private readonly esperaMateriales = (e: Expediente) => e.compras.some((c) => c.estado !== 'llego');

  protected readonly kpis = computed(() => {
    const l = this.sim.expedientes();
    const activos = l.filter((e) => e.etapa !== 'cobrado');
    return {
      activos: activos.length,
      cliente: l.filter((e) => e.etapa === 'cotizacion').length,
      materiales: activos.filter(this.esperaMateriales).length,
      facturar: l.filter((e) => e.etapa === 'conformidad').length,
      // Adelantos, valorizaciones y saldos aún no cobrados, por moneda (nunca se suman soles con dólares)
      cobrarPen: this.porCobrar(l, 'PEN'),
      cobrarUsd: this.porCobrar(l, 'USD'),
      adelantos: l.filter((e) => e.etapa !== 'cobrado' && !this.sim.adelantoListo(e)).length,
      tareas: l.flatMap((e) => e.tareas).filter((t) => !t.hecha).length,
      vencidas: l.flatMap((e) => e.tareas).filter((t) => !t.hecha && t.vence < hoy()).length,
    };
  });

  protected readonly visibles = computed(() => {
    const f = this.filtro();
    const t = this.texto().trim().toLowerCase();
    return this.sim
      .expedientes()
      .filter((e) => {
        if (f === 'cliente') return e.etapa === 'cotizacion';
        if (f === 'materiales') return e.etapa !== 'cobrado' && this.esperaMateriales(e);
        if (f === 'facturar') return e.etapa === 'conformidad';
        if (f === 'cobrar') return e.etapa === 'facturado';
        return true;
      })
      .filter((e) => !t || `${e.codigo} ${e.titulo} ${this.servicios.cliente(e.clienteId)?.razonSocial} ${e.ordenCliente?.numero ?? ''}`.toLowerCase().includes(t));
  });

  private porCobrar(l: Expediente[], moneda: 'PEN' | 'USD'): number {
    return l
      .filter((e) => (e.moneda ?? 'PEN') === moneda)
      .flatMap((e) => e.hitos ?? [])
      .filter((h) => h.estado !== 'cobrado')
      .reduce((s, h) => s + h.monto, 0);
  }

  protected indice(e: Expediente) {
    return indiceEtapa(e.etapa);
  }

  protected pendientes(e: Expediente) {
    return e.tareas.filter((t) => !t.hecha).length;
  }

  protected abrirNuevo() {
    this.nuevo = { clienteId: '', titulo: '', solicitud: '', responsableId: 'p1' };
    this.error.set(null);
    this.dialogo.set(true);
  }

  protected crear() {
    if (!this.nuevo.clienteId || this.nuevo.titulo.trim().length < 4) return this.error.set('Elige el cliente y describe el trabajo.');
    const e = this.sim.crear({ ...this.nuevo, titulo: this.nuevo.titulo.trim(), solicitud: this.nuevo.solicitud.trim() });
    this.dialogo.set(false);
    void this.router.navigate(['/proyectos/servicios', e.id]);
  }
}
