import { Component, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Emoji } from '../../../../shared/components/emoji/emoji';
import { AsientoDialogo, type AsientoGuardado } from '../../components/asiento-dialogo/asiento-dialogo';
import { AsientoTarjeta } from '../../components/asiento-tarjeta/asiento-tarjeta';
import { mensajeGuardado } from '../../data/textos';
import type { Asiento } from '../../models/contabilidad.model';
import { PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { pendientesDe } from '../../utils/permisos';

/** Inicio del contador: lo que tiene que corregir, terminar o está esperando aprobación. */
@Component({
  selector: 'app-mi-trabajo',
  imports: [ButtonModule, Emoji, AsientoDialogo, AsientoTarjeta, PeriodoPipe],
  templateUrl: './mi-trabajo.html',
  styleUrl: './mi-trabajo.scss',
})
export class MiTrabajo {
  protected readonly conta = inject(ContabilidadService);
  private readonly avisos = inject(MessageService);

  protected readonly pendientes = computed(() => pendientesDe(this.conta.asientos(), this.conta.persona()));

  protected readonly registrados = computed(
    () =>
      this.conta
        .asientos()
        .filter((a) => a.creadoPor === this.conta.persona().id && a.estado === 'registrado').length,
  );

  // Diálogo
  protected readonly dialogoVisible = signal(false);
  protected readonly editando = signal<Asiento | null>(null);

  protected nuevo() {
    this.editando.set(null);
    this.dialogoVisible.set(true);
  }

  protected corregir(a: Asiento) {
    this.editando.set(a);
    this.dialogoVisible.set(true);
  }

  protected guardar({ asiento, confirmar, id }: AsientoGuardado) {
    this.intentar(() => {
      const guardado = id ? this.conta.actualizar(id, asiento, confirmar) : this.conta.crear(asiento, confirmar);
      this.dialogoVisible.set(false);
      this.avisos.add({ severity: 'success', summary: mensajeGuardado(guardado), life: 3500 });
    });
  }

  protected enviar(a: Asiento) {
    this.intentar(() => {
      if (this.conta.permisos().registrar) this.conta.registrar(a.id);
      else this.conta.enviar(a.id);
      this.avisos.add({ severity: 'success', summary: mensajeGuardado(this.conta.buscar(a.id)), life: 3500 });
    });
  }

  protected eliminar(a: Asiento) {
    this.intentar(() => this.conta.eliminarBorrador(a.id));
  }

  private intentar(accion: () => void) {
    try {
      accion();
    } catch (e) {
      this.avisos.add({ severity: 'error', summary: 'No se pudo completar', detail: (e as Error).message, life: 6000 });
    }
  }
}
