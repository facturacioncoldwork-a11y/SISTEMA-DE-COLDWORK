import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ActividadLista } from '../../components/actividad-lista/actividad-lista';
import { AsientoTarjeta } from '../../components/asiento-tarjeta/asiento-tarjeta';
import type { Asiento, ConfigAprobacion } from '../../models/contabilidad.model';

type PermisoContador = keyof Pick<ConfigAprobacion, 'contadorRegistraDirecto' | 'contadorVeLibros'>;
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

  protected readonly pendientes = computed(() => [...this.conta.porAprobar()].sort((a, b) => a.numero - b.numero));

  // Diálogo "Observar"
  protected readonly observando = signal<Asiento | null>(null);
  protected comentario = '';

  protected cambiarPermiso(permiso: PermisoContador, activo: boolean) {
    const textos: Record<PermisoContador, [string, string]> = {
      contadorRegistraDirecto: ['El contador registra directo', 'El contador necesita tu aprobación'],
      contadorVeLibros: ['El contador puede ver los libros', 'El contador ya no ve los libros'],
    };
    void this.intentar(async () => {
      await this.conta.guardarConfig({ [permiso]: activo });
      this.avisos.add({ severity: 'success', summary: textos[permiso][activo ? 0 : 1], life: 3000 });
    });
  }

  protected aprobar(a: Asiento) {
    void this.intentar(async () => {
      await this.conta.registrar(a.id);
      this.avisos.add({ severity: 'success', summary: `Asiento ${a.numero} aprobado y registrado`, life: 3000 });
    });
  }

  /** Aprueba uno por uno: si alguno no cuadra, los demás igual se aprueban y se avisa. */
  protected aprobarTodos() {
    void this.intentar(async () => {
      const lista = this.pendientes();
      let aprobados = 0;
      for (const a of lista) {
        try {
          await this.conta.registrar(a.id);
          aprobados++;
        } catch (e) {
          this.avisos.add({ severity: 'error', summary: `Asiento ${a.numero}`, detail: (e as Error).message, life: 6000 });
        }
      }
      this.avisos.add({ severity: 'success', summary: `${aprobados} de ${lista.length} asientos aprobados`, life: 3000 });
    });
  }

  protected abrirObservar(a: Asiento) {
    this.comentario = '';
    this.observando.set(a);
  }

  protected confirmarObservacion() {
    const a = this.observando();
    if (!a || !this.comentario.trim()) return;
    void this.intentar(async () => {
      await this.conta.observar(a.id, this.comentario);
      this.observando.set(null);
      this.avisos.add({ severity: 'warn', summary: `Asiento ${a.numero} devuelto al contador`, life: 3000 });
    });
  }

  private async intentar(accion: () => Promise<unknown>) {
    try {
      await accion();
    } catch (e) {
      this.avisos.add({ severity: 'error', summary: 'No se pudo completar', detail: (e as Error).message, life: 6000 });
    }
  }
}