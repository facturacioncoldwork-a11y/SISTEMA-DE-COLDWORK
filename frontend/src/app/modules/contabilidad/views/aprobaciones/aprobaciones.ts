import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ActividadLista } from '../../components/actividad-lista/actividad-lista';
import { AsientoTarjeta } from '../../components/asiento-tarjeta/asiento-tarjeta';
import { CONTADORA } from '../../data/equipo-ejemplo';
import type { Asiento } from '../../models/contabilidad.model';
import { ContabilidadService } from '../../services/contabilidad.service';

/** Bandeja del dueño: asientos que envió el contador, permisos y actividad del equipo. */
@Component({
  selector: 'app-aprobaciones',
  imports: [FormsModule, ButtonModule, DialogModule, TextareaModule, ToggleSwitchModule, ActividadLista, AsientoTarjeta],
  templateUrl: './aprobaciones.html',
  styleUrl: './aprobaciones.scss',
})
export class Aprobaciones {
  protected readonly conta = inject(ContabilidadService);
  private readonly avisos = inject(MessageService);

  protected readonly contadora = CONTADORA;
  protected readonly pendientes = computed(() => [...this.conta.porAprobar()].sort((a, b) => a.numero - b.numero));

  // Diálogo "Observar"
  protected readonly observando = signal<Asiento | null>(null);
  protected comentario = '';

  protected cambiarPermiso(registraDirecto: boolean) {
    this.conta.config.set({ contadorRegistraDirecto: registraDirecto });
    this.avisos.add({
      severity: 'success',
      summary: registraDirecto ? 'El contador registra directo' : 'El contador necesita tu aprobación',
      life: 3000,
    });
  }

  protected aprobar(a: Asiento) {
    this.intentar(() => {
      this.conta.registrar(a.id);
      this.avisos.add({ severity: 'success', summary: `Asiento ${a.numero} aprobado y registrado`, life: 3000 });
    });
  }

  protected aprobarTodos() {
    this.intentar(() => {
      const lista = this.pendientes();
      lista.forEach((a) => this.conta.registrar(a.id));
      this.avisos.add({ severity: 'success', summary: `${lista.length} asientos aprobados`, life: 3000 });
    });
  }

  protected abrirObservar(a: Asiento) {
    this.comentario = '';
    this.observando.set(a);
  }

  protected confirmarObservacion() {
    const a = this.observando();
    if (!a || !this.comentario.trim()) return;
    this.intentar(() => {
      this.conta.observar(a.id, this.comentario);
      this.observando.set(null);
      this.avisos.add({ severity: 'warn', summary: `Asiento ${a.numero} devuelto al contador`, life: 3000 });
    });
  }

  private intentar(accion: () => void) {
    try {
      accion();
    } catch (e) {
      this.avisos.add({ severity: 'error', summary: 'No se pudo completar', detail: (e as Error).message, life: 6000 });
    }
  }
}
