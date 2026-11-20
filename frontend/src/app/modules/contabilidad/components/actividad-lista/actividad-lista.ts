import { Component, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ACCIONES } from '../../data/textos';
import type { Actividad } from '../../models/contabilidad.model';
import { CorrelativoPipe } from '../../pipes/formato.pipes';
import { ContabilidadService } from '../../services/contabilidad.service';

/** Historial "quién hizo qué y cuándo" (trazabilidad para el dueño y auditorías). */
@Component({
  selector: 'app-actividad-lista',
  imports: [DatePipe, CorrelativoPipe],
  templateUrl: './actividad-lista.html',
  styleUrl: './actividad-lista.scss',
})
export class ActividadLista {
  protected readonly conta = inject(ContabilidadService);

  readonly actividad = input.required<Actividad[]>();
  readonly limite = input(8);

  protected readonly acciones = ACCIONES;
}
