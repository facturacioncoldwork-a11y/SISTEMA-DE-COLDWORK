import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { nombrePersona } from '../../data/equipo-ejemplo';
import { ACCIONES } from '../../data/textos';
import type { Actividad } from '../../models/contabilidad.model';
import { CorrelativoPipe } from '../../pipes/formato.pipes';

/** Historial "quién hizo qué y cuándo" (trazabilidad para el dueño y auditorías). */
@Component({
  selector: 'app-actividad-lista',
  imports: [DatePipe, CorrelativoPipe],
  templateUrl: './actividad-lista.html',
  styleUrl: './actividad-lista.scss',
})
export class ActividadLista {
  readonly actividad = input.required<Actividad[]>();
  readonly limite = input(8);

  protected readonly acciones = ACCIONES;
  protected readonly nombrePersona = nombrePersona;
}
