import { Component, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Emoji } from '../../../../shared/components/emoji/emoji';
import type { NombreIcono } from '../../../../shared/components/emoji/iconos';
import { Saludo } from '../../../../shared/components/saludo/saludo';
import { AsientoDialogo, type AsientoGuardado } from '../../components/asiento-dialogo/asiento-dialogo';
import { AsientoTarjeta } from '../../components/asiento-tarjeta/asiento-tarjeta';
import { mensajeGuardado } from '../../data/textos';
import type { Asiento } from '../../models/contabilidad.model';
import { PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { pendientesDe } from '../../utils/permisos';

interface TarjetaArea {
  clave: string;
  nombre: string;
  sticker: NombreIcono;
  ruta: string;
  colores: [string, string];
  resumen: string;
}

/** Inicio del contador: lo que tiene que corregir, terminar o está esperando aprobación. */
@Component({
  selector: 'app-mi-trabajo',
  imports: [RouterLink, ButtonModule, Emoji, Saludo, AsientoDialogo, AsientoTarjeta, PeriodoPipe],
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

  /** SIMULACIÓN: áreas que el dueño le dio a María (luego vendrán de su cuenta). */
  private readonly misAreas = ['contabilidad'] as const;

  protected readonly chips = computed(() => ['COLDWORK', 'Contadora', 'Ves: Contabilidad']);

  /** Una tarjeta por área, con lo pendiente de esa área. */
  protected readonly areas = computed<TarjetaArea[]>(() => {
    const p = this.pendientes();
    const tarjetas: Record<(typeof this.misAreas)[number], TarjetaArea> = {
      contabilidad: {
        clave: 'contabilidad',
        nombre: 'Contabilidad',
        sticker: 'libro',
        ruta: '/trabajo/mis-asientos',
        colores: ['#8b5cf6', '#d946ef'],
        resumen: `${p.observados.length} por corregir · ${p.borradores.length} borradores`,
      },
    };
    return this.misAreas.map((a) => tarjetas[a]);
  });

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
