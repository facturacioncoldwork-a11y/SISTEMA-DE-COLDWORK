import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { nombreOrigen } from '../../data/sunat';
import { ESTADOS } from '../../data/textos';
import type { EstadoAsiento } from '../../models/contabilidad.model';
import { CorrelativoPipe, ImportePipe, PeriodoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';
import { totales } from '../../utils/partida-doble';

type Filtro = EstadoAsiento | 'todos';

/** Historial del contador: solo los asientos que hizo él y en qué estado están. */
@Component({
  selector: 'app-mis-asientos',
  imports: [FormsModule, SelectButtonModule, TagModule, CorrelativoPipe, ImportePipe, PeriodoPipe],
  templateUrl: './mis-asientos.html',
  styleUrl: './mis-asientos.scss',
})
export class MisAsientos {
  protected readonly conta = inject(ContabilidadService);

  protected readonly estados = ESTADOS;
  protected readonly nombreOrigen = nombreOrigen;
  protected readonly totales = totales;

  protected readonly filtro = signal<Filtro>('todos');
  protected readonly filtros = [
    { etiqueta: 'Todos', valor: 'todos' },
    { etiqueta: 'Registrados', valor: 'registrado' },
    { etiqueta: 'Por aprobar', valor: 'por_aprobar' },
    { etiqueta: 'Observados', valor: 'observado' },
    { etiqueta: 'Borradores', valor: 'borrador' },
  ];

  protected readonly mios = computed(() =>
    this.conta.asientos().filter((a) => a.creadoPor === this.conta.persona().id),
  );

  protected readonly visibles = computed(() =>
    this.mios().filter((a) => this.filtro() === 'todos' || a.estado === this.filtro()),
  );
}
