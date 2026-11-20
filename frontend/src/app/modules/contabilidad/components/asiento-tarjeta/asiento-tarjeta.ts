import { Component, computed, inject, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { nombreComprobante, nombreOrigen } from '../../data/sunat';
import { ESTADOS } from '../../data/textos';
import type { Asiento } from '../../models/contabilidad.model';
import { CorrelativoPipe, ImportePipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { totales } from '../../utils/partida-doble';

/**
 * Un asiento en formato tarjeta, con sus líneas.
 * Los botones de acción se pasan desde afuera:  <div acciones>…</div>
 */
@Component({
  selector: 'app-asiento-tarjeta',
  imports: [TagModule, CorrelativoPipe, ImportePipe],
  templateUrl: './asiento-tarjeta.html',
  styleUrl: './asiento-tarjeta.scss',
})
export class AsientoTarjeta {
  protected readonly conta = inject(ContabilidadService);

  readonly asiento = input.required<Asiento>();

  protected readonly estado = computed(() => ESTADOS[this.asiento().estado]);
  protected readonly total = computed(() => totales(this.asiento().lineas).debe);

  protected readonly nombreOrigen = nombreOrigen;
  protected readonly nombreComprobante = nombreComprobante;
}
